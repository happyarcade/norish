import { randomUUID } from "crypto";
import { access, mkdir, readdir, readFile, rename, stat, writeFile } from "fs/promises";
import path from "path";
import { and, asc, eq } from "drizzle-orm";

import { normalizeRecipeFromSchemaJson } from "@norish/api/parser";
import { db } from "@norish/db/drizzle";
import { createRecipeWithRefs } from "@norish/db/repositories";
import { recipes, users } from "@norish/db/schema";

import { repairMojibakeValue } from "./lib/repair-mojibake";

type NormalizedSchemaRecipe = Awaited<ReturnType<typeof normalizeRecipeFromSchemaJson>>;

interface CliOptions {
  targetPath: string;
  userId?: string;
  limit?: number;
  dryRun: boolean;
  skipImageDownloads: boolean;
  reportPath?: string;
  archiveProcessed: boolean;
  archiveDir?: string;
}

interface ImportCandidate {
  filePath: string;
  payload: unknown;
  sourceKey: string | null;
}

interface ReportSamples {
  skipped: Array<{ filePath: string; reason: string }>;
  failures: Array<{ filePath: string; error: string }>;
}

interface ReportCounters {
  fields: Map<string, number>;
  categories: Map<string, number>;
  tags: Map<string, number>;
  nutrientKeys: Map<string, number>;
  siteNames: Map<string, number>;
  recipeTypes: Map<string, number>;
  suitableSlots: Map<string, number>;
  dietaryFlags: Map<string, number>;
  cuisines: Map<string, number>;
  ingredientGroups: Map<string, number>;
  issues: Map<string, number>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;

  return true;
}

function incrementCounter(map: Map<string, number>, key: string | null | undefined): void {
  if (!key) return;

  const normalized = key.trim();

  if (!normalized) return;

  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function incrementCounters(
  map: Map<string, number>,
  values: Array<string | null | undefined>
): void {
  for (const value of values) {
    incrementCounter(map, value);
  }
}

function counterToRecord(map: Map<string, number>, limit = 50): Record<string, number> {
  return Object.fromEntries(
    Array.from(map.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit)
  );
}

function getNormalizedSourcePayload(rawPayload: unknown): Record<string, unknown> | null {
  if (!isRecord(rawPayload) || !isRecord(rawPayload.normalized)) return null;

  return rawPayload.normalized;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );
}

function hasSuspiciousEncoding(value: unknown): boolean {
  try {
    const text = JSON.stringify(value);

    return /(?:Â|Ã|â|�)/.test(text);
  } catch {
    return false;
  }
}

function createReportCounters(): ReportCounters {
  return {
    fields: new Map<string, number>(),
    categories: new Map<string, number>(),
    tags: new Map<string, number>(),
    nutrientKeys: new Map<string, number>(),
    siteNames: new Map<string, number>(),
    recipeTypes: new Map<string, number>(),
    suitableSlots: new Map<string, number>(),
    dietaryFlags: new Map<string, number>(),
    cuisines: new Map<string, number>(),
    ingredientGroups: new Map<string, number>(),
    issues: new Map<string, number>(),
  };
}

function recordPayloadFieldCoverage(payload: unknown, counters: ReportCounters): void {
  if (!isRecord(payload)) return;

  const fieldsToCheck = [
    "title",
    "name",
    "description",
    "url",
    "image",
    "yields",
    "recipeYield",
    "category",
    "recipeCategory",
    "keywords",
    "tags",
    "cuisine",
    "ingredients",
    "ingredient_groups",
    "instructions",
    "instructions_list",
    "nutrients",
    "nutrition",
  ];

  for (const field of fieldsToCheck) {
    if (hasValue(payload[field])) {
      incrementCounter(counters.fields, field);
    }
  }
}

function recordNormalizedCandidate(
  normalized: NormalizedSchemaRecipe,
  payload: unknown,
  counters: ReportCounters
): void {
  incrementCounter(counters.siteNames, getSiteLabel(normalized));
  incrementCounters(counters.categories, normalized.recipe.categories);
  incrementCounters(
    counters.tags,
    normalized.recipe.tags.map((tag) => tag.name)
  );
  incrementCounters(counters.recipeTypes, normalized.plannerProfile.recipeTypes);
  incrementCounters(counters.suitableSlots, normalized.plannerProfile.suitableSlots);
  incrementCounters(counters.dietaryFlags, normalized.plannerProfile.dietaryFlags);
  incrementCounters(counters.cuisines, normalized.plannerProfile.cuisines);

  const normalizedPayload = getNormalizedSourcePayload(normalized.source.rawPayload);
  const expandedNutrition = normalizedPayload?.expandedNutrition;

  if (isRecord(expandedNutrition)) {
    incrementCounters(counters.nutrientKeys, Object.keys(expandedNutrition));
  }

  const ingredientGroups = normalizedPayload?.ingredientGroups;

  if (Array.isArray(ingredientGroups)) {
    for (const group of ingredientGroups) {
      if (!isRecord(group)) continue;
      incrementCounter(
        counters.ingredientGroups,
        typeof group.purpose === "string" ? group.purpose : "ungrouped"
      );
    }
  }

  const nutritionDetails = normalized.recipe.nutritionDetails;
  const hasExtendedNutrition =
    isRecord(nutritionDetails) &&
    isRecord(nutritionDetails.nutrients) &&
    Object.keys(nutritionDetails.nutrients).length > 0;
  const hasCoreNutrition =
    normalized.recipe.calories != null ||
    normalized.recipe.fat != null ||
    normalized.recipe.carbs != null ||
    normalized.recipe.protein != null;

  if (!hasCoreNutrition && !hasExtendedNutrition) {
    incrementCounter(counters.issues, "missing nutrition");
  }

  for (const issue of normalized.importReview.issues) {
    incrementCounter(counters.issues, issue);
  }

  if (
    !normalized.importReview.issues.includes("possible encoding artifact") &&
    hasSuspiciousEncoding(payload)
  ) {
    incrementCounter(counters.issues, "possible encoding artifact");
  }
}

function looksLikeCollectionPage(payload: Record<string, unknown>): boolean {
  const title = typeof payload.title === "string" ? payload.title.toLowerCase() : "";
  const ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];
  const instructions = Array.isArray(payload.instructions_list) ? payload.instructions_list : [];

  return (
    ingredients.length <= 2 &&
    instructions.length === 0 &&
    ["recipes", "collection", "ideas", "dinners", "meals"].some((word) => title.includes(word))
  );
}

function shouldSkipCandidate(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  if (looksLikeCollectionPage(payload)) return "collection-like page";
  if (!hasValue(payload.ingredients)) return "missing ingredients";
  if (!hasValue(payload.instructions_list) && !hasValue(payload.instructions))
    return "missing instructions";

  return null;
}

function getSiteLabel(normalized: NormalizedSchemaRecipe): string {
  const siteName = normalized.source.siteName?.trim();

  if (siteName) return siteName;

  const sourceDomain = normalized.source.sourceDomain?.trim();

  if (sourceDomain) return sourceDomain;

  return "Unknown";
}

function expandSchemaJsonCandidates(filePath: string, parsed: unknown): ImportCandidate[] {
  if (isRecord(parsed) && isRecord(parsed.recipes)) {
    return Object.entries(parsed.recipes).map(([sourceKey, payload]) => ({
      filePath,
      payload,
      sourceKey,
    }));
  }

  return [
    {
      filePath,
      payload: parsed,
      sourceKey: null,
    },
  ];
}

function readArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);

  if (index === -1) return undefined;

  return args[index + 1];
}

function parseArgs(argv: string[]): CliOptions {
  const targetPath = readArgValue(argv, "--dir") ?? readArgValue(argv, "--path");

  if (!targetPath) {
    throw new Error("Missing required --dir <path> argument");
  }

  const limitValue = readArgValue(argv, "--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

  if (limitValue && (!Number.isFinite(limit) || limit! <= 0)) {
    throw new Error("--limit must be a positive integer");
  }

  return {
    targetPath,
    userId: readArgValue(argv, "--user-id"),
    limit,
    dryRun: argv.includes("--dry-run") || argv.includes("--preflight"),
    skipImageDownloads: argv.includes("--skip-image-downloads") || argv.includes("--preflight"),
    reportPath: readArgValue(argv, "--report"),
    archiveProcessed:
      argv.includes("--archive-processed") || Boolean(readArgValue(argv, "--archive-dir")),
    archiveDir: readArgValue(argv, "--archive-dir"),
  };
}

function deriveArchiveDir(targetPath: string, requestedArchiveDir?: string): string {
  if (requestedArchiveDir) return path.resolve(requestedArchiveDir);

  const resolvedTarget = path.resolve(targetPath);

  return path.join(path.dirname(resolvedTarget), "archive");
}

function deriveRecipesRootDir(targetPath: string): string {
  const resolvedTarget = path.resolve(targetPath);

  if (path.extname(resolvedTarget).toLowerCase() === ".json") {
    return path.dirname(resolvedTarget);
  }

  const baseName = path.basename(resolvedTarget).toLowerCase();

  if (baseName === "incoming" || baseName === "archive") {
    return path.dirname(resolvedTarget);
  }

  return resolvedTarget;
}

function deriveSiteNamesPath(targetPath: string): string {
  return path.join(deriveRecipesRootDir(targetPath), "site-names.json");
}

async function resolveArchiveDestination(
  archiveDir: string,
  sourceFilePath: string
): Promise<string> {
  const parsed = path.parse(sourceFilePath);
  let attempt = 0;

  while (true) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    const candidate = path.join(archiveDir, `${parsed.name}${suffix}${parsed.ext}`);

    try {
      await access(candidate);
      attempt += 1;
    } catch {
      return candidate;
    }
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");

    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function mergeCounterRecords(
  existing: Record<string, number> | undefined,
  additions: Record<string, number>
): Record<string, number> {
  const merged = new Map<string, number>();

  for (const [key, value] of Object.entries(existing ?? {})) {
    merged.set(key, value);
  }

  for (const [key, value] of Object.entries(additions)) {
    merged.set(key, (merged.get(key) ?? 0) + value);
  }

  return counterToRecord(merged, Number.MAX_SAFE_INTEGER);
}

async function collectJsonFiles(targetPath: string): Promise<string[]> {
  const resolved = path.resolve(targetPath);
  const targetStats = await stat(resolved);

  if (targetStats.isFile()) {
    if (resolved.toLowerCase().endsWith(".json")) return [resolved];

    throw new Error("Target file must be a .json file");
  }

  const collected: string[] = [];

  async function visit(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        collected.push(fullPath);
      }
    }
  }

  await visit(resolved);

  return collected.sort((left, right) => left.localeCompare(right));
}

async function resolveUserId(requestedUserId?: string): Promise<string> {
  if (requestedUserId) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, requestedUserId))
      .limit(1);

    if (!row) {
      throw new Error(`No user found with id ${requestedUserId}`);
    }

    return row.id;
  }

  const [firstUser] = await db
    .select({ id: users.id })
    .from(users)
    .orderBy(asc(users.createdAt))
    .limit(1);

  if (!firstUser) {
    throw new Error("No users exist yet. Create/sign in to a Norish account before importing.");
  }

  return firstUser.id;
}

async function findExistingRecipeId(userId: string, recipeUrl: string): Promise<string | null> {
  const [row] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.userId, userId), eq(recipes.url, recipeUrl)))
    .limit(1);

  return row?.id ?? null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = await collectJsonFiles(options.targetPath);

  if (files.length === 0) {
    throw new Error("No JSON files found at the provided path");
  }

  const filesToProcess = files;
  const userId = options.dryRun ? null : await resolveUserId(options.userId);

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let validated = 0;
  let skippedInvalid = 0;
  let totalCandidates = 0;
  let archived = 0;
  const failures: Array<{ filePath: string; error: string }> = [];
  const reportSamples: ReportSamples = { skipped: [], failures: [] };
  const reportCounters = createReportCounters();
  const skipReasons = new Map<string, number>();
  const importedSiteNames = new Map<string, number>();
  const archivedSiteNames = new Map<string, number>();
  const filesQueuedForArchive = new Set<string>();
  const archiveDir =
    options.archiveProcessed && !options.dryRun
      ? deriveArchiveDir(options.targetPath, options.archiveDir)
      : null;
  const siteNamesPath = deriveSiteNamesPath(options.targetPath);

  if (archiveDir) {
    await mkdir(archiveDir, { recursive: true });
  }

  console.log(
    `${options.dryRun ? "Validating" : "Importing"} ${filesToProcess.length} schema JSON file(s)${
      userId ? ` for user ${userId}` : ""
    }`
  );

  for (const [index, filePath] of filesToProcess.entries()) {
    let canArchiveFile = true;
    const fileArchivedSiteNames = new Map<string, number>();

    try {
      const rawText = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "");
      const parsed = repairMojibakeValue(JSON.parse(rawText) as unknown);
      const candidates = expandSchemaJsonCandidates(filePath, parsed);

      for (const candidate of candidates) {
        if (options.limit && totalCandidates >= options.limit) break;

        totalCandidates += 1;
        recordPayloadFieldCoverage(candidate.payload, reportCounters);

        const skipReason = shouldSkipCandidate(candidate.payload);

        if (skipReason) {
          skippedInvalid += 1;
          canArchiveFile = false;
          skipReasons.set(skipReason, (skipReasons.get(skipReason) ?? 0) + 1);
          incrementCounter(reportCounters.issues, skipReason);

          if (reportSamples.skipped.length < 50) {
            reportSamples.skipped.push({
              filePath: candidate.sourceKey
                ? `${candidate.filePath}#${candidate.sourceKey}`
                : candidate.filePath,
              reason: skipReason,
            });
          }

          continue;
        }

        try {
          const recipeId = randomUUID();
          const normalized = await normalizeRecipeFromSchemaJson(candidate.payload, {
            sourceFilePath: candidate.sourceKey
              ? `${candidate.filePath}#${candidate.sourceKey}`
              : candidate.filePath,
            recipeId,
            downloadImages: !options.dryRun && !options.skipImageDownloads,
          });
          recordNormalizedCandidate(normalized, candidate.payload, reportCounters);

          if (options.dryRun) {
            validated += 1;
          } else {
            if (!userId) {
              throw new Error("No user resolved for import");
            }

            const existingRecipeId = await findExistingRecipeId(
              userId,
              normalized.recipe.url ?? ""
            );
            const siteLabel = getSiteLabel(normalized);

            if (existingRecipeId) {
              skipped += 1;
              if (archiveDir) {
                incrementCounter(fileArchivedSiteNames, siteLabel);
              }
            } else {
              await createRecipeWithRefs(recipeId, userId, normalized.recipe, {
                source: normalized.source,
                plannerProfile: normalized.plannerProfile,
                importReview: normalized.importReview,
              });
              imported += 1;
              incrementCounter(importedSiteNames, siteLabel);
              if (archiveDir) {
                incrementCounter(fileArchivedSiteNames, siteLabel);
              }
            }
          }
        } catch (error) {
          failed += 1;
          canArchiveFile = false;
          const failure = {
            filePath: candidate.sourceKey
              ? `${candidate.filePath}#${candidate.sourceKey}`
              : candidate.filePath,
            error: error instanceof Error ? error.message : String(error),
          };
          failures.push({
            filePath: failure.filePath,
            error: failure.error,
          });

          if (reportSamples.failures.length < 50) {
            reportSamples.failures.push(failure);
          }
        }
      }

      if (options.limit && totalCandidates >= options.limit) {
        break;
      }
    } catch (error) {
      failed += 1;
      canArchiveFile = false;
      const failure = {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      };
      failures.push(failure);

      if (reportSamples.failures.length < 50) {
        reportSamples.failures.push(failure);
      }
    }

    if ((index + 1) % 50 === 0 || index === filesToProcess.length - 1) {
      console.log(`Processed ${index + 1}/${filesToProcess.length}`);
    }

    if (archiveDir && canArchiveFile) {
      for (const [siteName, count] of fileArchivedSiteNames.entries()) {
        archivedSiteNames.set(siteName, (archivedSiteNames.get(siteName) ?? 0) + count);
      }
      filesQueuedForArchive.add(filePath);
    }
  }

  if (archiveDir && filesQueuedForArchive.size > 0) {
    for (const sourceFilePath of filesQueuedForArchive) {
      const destinationPath = await resolveArchiveDestination(archiveDir, sourceFilePath);
      await rename(sourceFilePath, destinationPath);
      archived += 1;
    }

    console.log(`Archived ${archived} file(s) to ${archiveDir}`);
  }

  if (!options.dryRun) {
    const existingSiteReport = await readJsonFile<{
      updatedAt?: string;
      lastBatch?: {
        targetPath?: string;
        imported?: Record<string, number>;
        archived?: Record<string, number>;
      };
      cumulative?: {
        imported?: Record<string, number>;
        archived?: Record<string, number>;
      };
    }>(siteNamesPath);
    const importedSiteNamesRecord = counterToRecord(importedSiteNames, Number.MAX_SAFE_INTEGER);
    const archivedSiteNamesRecord = counterToRecord(archivedSiteNames, Number.MAX_SAFE_INTEGER);
    const siteReport = {
      updatedAt: new Date().toISOString(),
      lastBatch: {
        targetPath: path.resolve(options.targetPath),
        imported: importedSiteNamesRecord,
        archived: archivedSiteNamesRecord,
      },
      cumulative: {
        imported: mergeCounterRecords(
          existingSiteReport?.cumulative?.imported,
          importedSiteNamesRecord
        ),
        archived: mergeCounterRecords(
          existingSiteReport?.cumulative?.archived,
          archivedSiteNamesRecord
        ),
      },
    };

    await writeFile(siteNamesPath, `${JSON.stringify(siteReport, null, 2)}\n`, "utf8");
    console.log(`Site names written: ${siteNamesPath}`);
  }

  if (options.dryRun) {
    console.log(
      `Dry run complete. Candidates: ${totalCandidates}, Valid: ${validated}, Skipped invalid: ${skippedInvalid}, Failed: ${failed}`
    );
  } else {
    console.log(
      `Import complete. Candidates: ${totalCandidates}, Imported: ${imported}, Skipped existing: ${skipped}, Skipped invalid: ${skippedInvalid}, Failed: ${failed}`
    );
  }

  if (skipReasons.size > 0) {
    console.log("Skip reasons:");

    for (const [reason, count] of Array.from(skipReasons.entries()).sort(
      (left, right) => right[1] - left[1]
    )) {
      console.log(`- ${reason}: ${count}`);
    }
  }

  if (failures.length > 0) {
    console.log("Sample failures:");

    for (const failure of failures.slice(0, 20)) {
      console.log(`- ${failure.filePath}`);
      console.log(`  ${failure.error}`);
    }
  }

  if (options.reportPath) {
    const reportPath = path.resolve(options.reportPath);
    const report = {
      generatedAt: new Date().toISOString(),
      mode: options.dryRun ? "dry-run" : "import",
      targetPath: path.resolve(options.targetPath),
      fileCount: filesToProcess.length,
      totals: {
        candidates: totalCandidates,
        valid: validated,
        imported,
        skippedExisting: skipped,
        skippedInvalid,
        failed,
        archived,
      },
      skipReasons: counterToRecord(skipReasons),
      issues: counterToRecord(reportCounters.issues),
      coverage: {
        fields: counterToRecord(reportCounters.fields),
        categories: counterToRecord(reportCounters.categories),
        tags: counterToRecord(reportCounters.tags),
        nutrientKeys: counterToRecord(reportCounters.nutrientKeys),
        siteNames: counterToRecord(reportCounters.siteNames),
        recipeTypes: counterToRecord(reportCounters.recipeTypes),
        suitableSlots: counterToRecord(reportCounters.suitableSlots),
        dietaryFlags: counterToRecord(reportCounters.dietaryFlags),
        cuisines: counterToRecord(reportCounters.cuisines),
        ingredientGroups: counterToRecord(reportCounters.ingredientGroups),
      },
      samples: reportSamples,
    };

    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Report written: ${reportPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
