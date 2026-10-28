import { randomUUID } from "crypto";
import { readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";

import { normalizeRecipeFromSchemaJson } from "@norish/api/parser";

type NormalizedSchemaRecipe = Awaited<ReturnType<typeof normalizeRecipeFromSchemaJson>>;

type SiteNamesFile = {
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function incrementCounter(map: Map<string, number>, key: string | null | undefined): void {
  if (!key) return;

  const normalized = key.trim();

  if (!normalized) return;

  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function counterToRecord(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    Array.from(map.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  );
}

function getSiteLabel(normalized: NormalizedSchemaRecipe): string {
  const siteName = normalized.source.siteName?.trim();

  if (siteName) return siteName;

  const sourceDomain = normalized.source.sourceDomain?.trim();

  if (sourceDomain) return sourceDomain;

  return "Unknown";
}

function expandSchemaJsonCandidates(filePath: string, parsed: unknown) {
  if (isRecord(parsed) && isRecord(parsed.recipes)) {
    return Object.entries(parsed.recipes).map(([sourceKey, payload]) => ({
      filePath,
      payload,
      sourceKey,
    }));
  }

  return [{ filePath, payload: parsed, sourceKey: null }];
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

function readArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);

  if (index === -1) return undefined;

  return args[index + 1];
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

async function main() {
  const archivePath =
    readArgValue(process.argv.slice(2), "--archive-dir") ??
    "C:\\Users\\Stuart\\Documents\\OMM2.0\\Project-Norish\\recipes\\archive";
  const outputPath =
    readArgValue(process.argv.slice(2), "--output") ??
    "C:\\Users\\Stuart\\Documents\\OMM2.0\\Project-Norish\\recipes\\site-names.json";

  const files = await collectJsonFiles(archivePath);
  const counters = new Map<string, number>();
  let totalCandidates = 0;

  console.log(`Scanning ${files.length} archived schema JSON file(s)`);

  for (const [index, filePath] of files.entries()) {
    const rawText = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "");
    const parsed = JSON.parse(rawText) as unknown;
    const candidates = expandSchemaJsonCandidates(filePath, parsed);

    for (const candidate of candidates) {
      totalCandidates += 1;

      const normalized = await normalizeRecipeFromSchemaJson(candidate.payload, {
        sourceFilePath: candidate.sourceKey ? `${candidate.filePath}#${candidate.sourceKey}` : candidate.filePath,
        recipeId: randomUUID(),
        downloadImages: false,
      });

      incrementCounter(counters, getSiteLabel(normalized));
    }

    if ((index + 1) % 100 === 0 || index === files.length - 1) {
      console.log(`Processed ${index + 1}/${files.length}`);
    }
  }

  const existing = await readJsonFile<SiteNamesFile>(outputPath);
  const records = counterToRecord(counters);
  const nextFile: SiteNamesFile = {
    updatedAt: new Date().toISOString(),
    lastBatch: existing?.lastBatch,
    cumulative: {
      imported: records,
      archived: records,
    },
  };

  await writeFile(path.resolve(outputPath), `${JSON.stringify(nextFile, null, 2)}\n`, "utf8");

  console.log(
    `Backfill complete. Files: ${files.length}, Candidates: ${totalCandidates}, Sites: ${Object.keys(records).length}`
  );
  console.log(`Site names written: ${path.resolve(outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
