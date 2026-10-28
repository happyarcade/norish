import { writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";

import { classifyDairyAdaptation } from "@norish/api/parser";
import {
  db,
  ingredients,
  recipeIngredients,
  recipePlannerProfiles,
  recipes,
  recipeTags,
  resetDbConnection,
  tags,
} from "@norish/db";

const TAG_NAME = "dairy-free-possible";
const BATCH_SIZE = 500;

type RecipeCandidate = {
  title: string;
  ingredientLines: string[];
  dietaryFlags: string[];
};

function readArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function batches<T>(values: T[]): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += BATCH_SIZE) {
    result.push(values.slice(index, index + BATCH_SIZE));
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("--preflight");
  const reportPath = path.resolve(
    readArg(args, "--report") ?? "dairy-free-possible-backfill-report.json"
  );
  const rows = await db
    .select({
      recipeId: recipes.id,
      title: recipes.name,
      rawLine: recipeIngredients.rawLine,
      ingredientName: ingredients.name,
      dietaryFlags: recipePlannerProfiles.dietaryFlags,
    })
    .from(recipes)
    .leftJoin(recipePlannerProfiles, eq(recipePlannerProfiles.recipeId, recipes.id))
    .leftJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
    .leftJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId));

  const candidates = new Map<string, RecipeCandidate>();

  for (const row of rows) {
    const candidate = candidates.get(row.recipeId) ?? {
      title: row.title,
      ingredientLines: [],
      dietaryFlags: row.dietaryFlags ?? [],
    };
    const ingredientLine = row.rawLine?.trim() || row.ingredientName?.trim();

    if (ingredientLine) candidate.ingredientLines.push(ingredientLine);
    candidates.set(row.recipeId, candidate);
  }

  const qualifyingIds: string[] = [];
  const statusCounts = new Map<string, number>();
  const substitutionCounts = new Map<string, number>();

  for (const [recipeId, candidate] of candidates) {
    const explicitDairyFree = candidate.dietaryFlags.some(
      (flag) => flag.toLowerCase() === "dairy-free"
    );
    const result = classifyDairyAdaptation({
      title: candidate.title,
      ingredientLines: candidate.ingredientLines,
      explicitDairyFree,
    });

    statusCounts.set(result.status, (statusCounts.get(result.status) ?? 0) + 1);
    for (const substitution of result.substitutions) {
      substitutionCounts.set(substitution, (substitutionCounts.get(substitution) ?? 0) + 1);
    }
    if (result.status !== "contains-dairy") qualifyingIds.push(recipeId);
  }

  if (!dryRun) {
    await db.transaction(async (tx) => {
      await tx.update(recipePlannerProfiles).set({
        dietaryFlags: sql<
          string[]
        >`array_remove(${recipePlannerProfiles.dietaryFlags}, ${TAG_NAME})`,
        updatedAt: new Date(),
      });

      for (const recipeIdBatch of batches(qualifyingIds)) {
        await tx
          .update(recipePlannerProfiles)
          .set({
            dietaryFlags: sql<
              string[]
            >`array_append(${recipePlannerProfiles.dietaryFlags}, ${TAG_NAME})`,
            updatedAt: new Date(),
          })
          .where(inArray(recipePlannerProfiles.recipeId, recipeIdBatch));
      }

      await tx.insert(tags).values({ name: TAG_NAME }).onConflictDoNothing();
      const [tag] = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(eq(sql`lower(${tags.name})`, TAG_NAME))
        .limit(1);

      if (!tag) throw new Error(`Unable to create or find ${TAG_NAME} tag`);

      await tx.delete(recipeTags).where(eq(recipeTags.tagId, tag.id));
      for (const recipeIdBatch of batches(qualifyingIds)) {
        await tx
          .insert(recipeTags)
          .values(recipeIdBatch.map((recipeId) => ({ recipeId, tagId: tag.id, order: 10_000 })))
          .onConflictDoNothing();
      }
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "backfill",
    totalRecipes: candidates.size,
    qualifyingRecipes: qualifyingIds.length,
    statuses: Object.fromEntries(
      Array.from(statusCounts.entries()).sort((left, right) => right[1] - left[1])
    ),
    substitutions: Object.fromEntries(
      Array.from(substitutionCounts.entries()).sort((left, right) => right[1] - left[1])
    ),
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
