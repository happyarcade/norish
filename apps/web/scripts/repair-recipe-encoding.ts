import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";

import {
  db,
  recipeImportReviews,
  recipeIngredients,
  recipes,
  resetDbConnection,
  steps,
} from "@norish/db";

import { hasMojibake, repairMojibakeText, repairMojibakeValue } from "./lib/repair-mojibake";

type ShortlistReport = {
  shortlist?: Array<{ url?: string }>;
};

function readArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const input = readArg(args, "--input");
  if (!input) throw new Error("Missing required --input <shortlist-report.json> argument");

  const dryRun = args.includes("--dry-run") || args.includes("--preflight");
  const inputPath = path.resolve(input);
  const reportPath = path.resolve(
    readArg(args, "--report") ?? "recipe-encoding-repair-report.json"
  );
  const shortlist = JSON.parse(await readFile(inputPath, "utf8")) as ShortlistReport;
  const urls = Array.from(
    new Set(shortlist.shortlist?.flatMap((recipe) => (recipe.url ? [recipe.url] : [])) ?? [])
  );

  if (urls.length === 0) throw new Error("The shortlist report contains no recipe URLs");

  const recipeRows = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      description: recipes.description,
      notes: recipes.notes,
      ingredientGroups: recipes.ingredientGroups,
      nutritionDetails: recipes.nutritionDetails,
    })
    .from(recipes)
    .where(inArray(recipes.url, urls));
  const recipeIds = recipeRows.map((recipe) => recipe.id);
  const stepRows = await db
    .select({ id: steps.id, step: steps.step })
    .from(steps)
    .where(inArray(steps.recipeId, recipeIds));
  const ingredientRows = await db
    .select({
      id: recipeIngredients.id,
      rawLine: recipeIngredients.rawLine,
      unit: recipeIngredients.unit,
    })
    .from(recipeIngredients)
    .where(inArray(recipeIngredients.recipeId, recipeIds));
  const reviewRows = await db
    .select({
      id: recipeImportReviews.id,
      issues: recipeImportReviews.issues,
      needsReview: recipeImportReviews.needsReview,
    })
    .from(recipeImportReviews)
    .where(inArray(recipeImportReviews.recipeId, recipeIds));

  let recipeFields = 0;
  let repairedSteps = 0;
  let repairedIngredients = 0;
  let clearedReviewWarnings = 0;

  await db.transaction(async (tx) => {
    for (const recipe of recipeRows) {
      const repaired = repairMojibakeValue({
        name: recipe.name,
        description: recipe.description,
        notes: recipe.notes,
        ingredientGroups: recipe.ingredientGroups,
        nutritionDetails: recipe.nutritionDetails,
      });
      const changed =
        JSON.stringify(repaired) !==
        JSON.stringify({
          name: recipe.name,
          description: recipe.description,
          notes: recipe.notes,
          ingredientGroups: recipe.ingredientGroups,
          nutritionDetails: recipe.nutritionDetails,
        });

      if (changed) {
        recipeFields += 1;
        if (!dryRun) {
          await tx
            .update(recipes)
            .set({ ...repaired, updatedAt: new Date() })
            .where(eq(recipes.id, recipe.id));
        }
      }
    }

    for (const row of stepRows) {
      const step = repairMojibakeText(row.step);
      if (step === row.step) continue;
      repairedSteps += 1;
      if (!dryRun) {
        await tx.update(steps).set({ step, updatedAt: new Date() }).where(eq(steps.id, row.id));
      }
    }

    for (const row of ingredientRows) {
      const rawLine = row.rawLine == null ? null : repairMojibakeText(row.rawLine);
      const unit = row.unit == null ? null : repairMojibakeText(row.unit);
      if (rawLine === row.rawLine && unit === row.unit) continue;
      repairedIngredients += 1;
      if (!dryRun) {
        await tx
          .update(recipeIngredients)
          .set({ rawLine, unit, updatedAt: new Date() })
          .where(eq(recipeIngredients.id, row.id));
      }
    }

    for (const review of reviewRows) {
      const issues = review.issues.filter((issue) => issue !== "possible encoding artifact");
      if (issues.length === review.issues.length) continue;
      clearedReviewWarnings += 1;
      if (!dryRun) {
        await tx
          .update(recipeImportReviews)
          .set({
            issues,
            needsReview: review.needsReview && issues.length > 0,
            updatedAt: new Date(),
          })
          .where(eq(recipeImportReviews.id, review.id));
      }
    }
  });

  const remainingSuspicious = [
    ...recipeRows.flatMap((recipe) => [recipe.name, recipe.description, recipe.notes]),
    ...stepRows.map((row) => row.step),
    ...ingredientRows.flatMap((row) => [row.rawLine, row.unit]),
  ].filter(
    (value): value is string => value != null && hasMojibake(repairMojibakeText(value))
  ).length;
  const report = {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "repair",
    inputPath,
    shortlistUrls: urls.length,
    matchedRecipes: recipeRows.length,
    repaired: {
      recipeFields,
      steps: repairedSteps,
      ingredients: repairedIngredients,
      reviewWarnings: clearedReviewWarnings,
    },
    remainingSuspicious,
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);
}

try {
  await main();
} finally {
  await resetDbConnection();
}
