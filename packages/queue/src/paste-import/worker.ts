/**
 * Paste Import Worker
 *
 * Processes pasted recipe text or pasted JSON-LD.
 * Uses lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";
import type { PasteImportJobData } from "@norish/queue/contracts/job-types";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts";
import type { PolicyEmitContext } from "@norish/queue/events/policy";

import { extractRecipeWithAI } from "@norish/api/ai/recipe-parser";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";
import { createLogger } from "@norish/shared-server/logger";
import { extractRecipeNodesFromJsonLd } from "@norish/api/parser/jsonld";
import { normalizeRecipeFromJson } from "@norish/api/parser/normalize";
import {
  getAIConfig,
  getRecipePermissionPolicy,
  isAIEnabled,
} from "@norish/config/server-config-loader";
import { createRecipeWithRefs, dashboardRecipe, getAllergiesForUsers } from "@norish/db";
import { addAllergyDetectionJob } from "@norish/queue/allergy-detection/producer";
import { addAutoTaggingJob } from "@norish/queue/auto-tagging/producer";
import { emitByPolicy } from "@norish/queue/events/policy";
import { recipeEmitter } from "@norish/queue/events/recipes";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { getQueues } from "@norish/queue/registry";
import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:paste-import");

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();

  if (t.startsWith("{") || t.startsWith("[")) return true;

  return t.includes("@context") || t.includes("@graph") || t.includes('"@type"');
}

function hasStepsAndIngredients(parsed: FullRecipeInsertDTO): boolean {
  return (
    !!parsed &&
    Array.isArray(parsed.recipeIngredients) &&
    parsed.recipeIngredients.length > 0 &&
    Array.isArray(parsed.steps) &&
    parsed.steps.length > 0
  );
}

function readTextValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = readTextValue(item);

      if (parsed) return parsed;
    }

    return null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return readTextValue(record.name) ?? readTextValue(record.text) ?? readTextValue(record["@value"]);
  }

  return null;
}

function buildPastedRecipeSource(rawPayload: unknown, sourceType: "schema_org" | "scraped") {
  const record = rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : null;

  return {
    sourceType,
    sourceUrl: null,
    sourceDomain: null,
    siteName: readTextValue(record?.publisher) ?? null,
    author: readTextValue(record?.author),
    language: readTextValue(record?.inLanguage),
    rawPayload,
  };
}

interface ParseResult {
  recipe: FullRecipeInsertDTO;
  usedAI: boolean;
  source: {
    sourceType: "schema_org" | "scraped";
    sourceUrl: null;
    sourceDomain: null;
    siteName: string | null;
    author: string | null;
    language: string | null;
    rawPayload: unknown;
  };
}

async function parseFromPastedText(
  text: string,
  recipeId: string,
  allergies?: string[],
  forceAI?: boolean
): Promise<ParseResult> {
  const trimmed = text.trim();

  if (!trimmed) throw new Error("No text provided");
  if (trimmed.length > MAX_RECIPE_PASTE_CHARS) {
    throw new Error(`Paste is too large (max ${MAX_RECIPE_PASTE_CHARS} characters)`);
  }

  const aiEnabled = await isAIEnabled();

  if (forceAI) {
    if (!aiEnabled) {
      throw new Error("AI-only import requested but AI is not enabled.");
    }

    const html = `<html><body><main><h1>Pasted recipe</h1><p>${escapeHtml(trimmed)}</p></main></body></html>`;
    const ai = await extractRecipeWithAI(html, recipeId, undefined, allergies);

    if (ai.success && hasStepsAndIngredients(ai.data)) {
      return {
        recipe: ai.data,
        usedAI: true,
        source: buildPastedRecipeSource(
          {
            source: "pasted_text",
            extractionMethod: "ai",
            text: trimmed,
          },
          "scraped"
        ),
      };
    }

    throw new Error("Could not parse pasted recipe.");
  }

  if (looksLikeJson(trimmed)) {
    const html = `<html><head></head><body><script type="application/ld+json">${trimmed}</script></body></html>`;
    const nodes = extractRecipeNodesFromJsonLd(html);

    if (nodes.length > 0) {
      const normalized = await normalizeRecipeFromJson(nodes[0], recipeId);

      if (normalized) {
        normalized.url = null;
        if (hasStepsAndIngredients(normalized)) {
          return {
            recipe: normalized,
            usedAI: false,
            source: buildPastedRecipeSource(nodes[0], "schema_org"),
          };
        }
      }
    }
  }

  if (!aiEnabled) {
    throw new Error("Could not parse pasted recipe. Try pasting JSON-LD, or enable AI import.");
  }

  const html = `<html><body><main><h1>Pasted recipe</h1><p>${escapeHtml(trimmed)}</p></main></body></html>`;
  const ai = await extractRecipeWithAI(html, recipeId, undefined, allergies);

  if (ai.success && hasStepsAndIngredients(ai.data)) {
    return {
      recipe: ai.data,
      usedAI: true,
      source: buildPastedRecipeSource(
        {
          source: "pasted_text",
          extractionMethod: "ai_fallback",
          text: trimmed,
        },
        "scraped"
      ),
    };
  }

  throw new Error("Could not parse pasted recipe.");
}

async function processPasteImportJob(job: Job<PasteImportJobData>): Promise<void> {
  const { recipeId, userId, householdKey, householdUserIds, text, forceAI } = job.data;

  log.info(
    { jobId: job.id, recipeId, attempt: job.attemptsMade + 1 },
    "Processing paste import job"
  );

  const policy = await getRecipePermissionPolicy();
  const viewPolicy = policy.view;
  const ctx: PolicyEmitContext = { userId, householdKey };

  emitByPolicy(recipeEmitter, viewPolicy, ctx, "importStarted", {
    recipeId,
    url: "[pasted]",
  });

  const aiConfig = await getAIConfig();
  let allergyNames: string[] | undefined;

  if (aiConfig?.autoTagAllergies) {
    const householdAllergies = await getAllergiesForUsers(householdUserIds ?? [userId]);

    allergyNames = [...new Set(householdAllergies.map((a) => a.tagName))];
    log.debug(
      { allergyCount: allergyNames.length },
      "Fetched household allergies for paste import"
    );
  }

  const parseResult = await parseFromPastedText(text, recipeId, allergyNames, forceAI);

  const createdId = await createRecipeWithRefs(recipeId, userId, parseResult.recipe, {
    source: parseResult.source,
  });

  if (!createdId) {
    throw new Error("Failed to save imported recipe");
  }

  const dashboardDto = await dashboardRecipe(createdId);

  if (dashboardDto) {
    log.info(
      { jobId: job.id, recipeId: createdId, usedAI: parseResult.usedAI },
      "Pasted recipe imported successfully"
    );

    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: recipeId,
      toast: parseResult.usedAI ? "imported" : undefined,
    });

    if (!parseResult.usedAI) {
      const queues = getQueues();

      await addAutoTaggingJob(queues.autoTagging, {
        recipeId: createdId,
        userId,
        householdKey,
      });

      await addAllergyDetectionJob(queues.allergyDetection, {
        recipeId: createdId,
        userId,
        householdKey,
      });
    }
  }
}

async function handleJobFailed(
  job: Job<PasteImportJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { recipeId, userId, householdKey } = job.data;
  const maxAttempts = job.opts.attempts ?? 3;
  const isFinalFailure = job.attemptsMade >= maxAttempts;

  log.error(
    {
      jobId: job.id,
      recipeId,
      attempt: job.attemptsMade,
      maxAttempts,
      isFinalFailure,
      error: error.message,
    },
    "Paste import job failed"
  );

  await deleteRecipeImagesDir(recipeId);

  if (isFinalFailure) {
    const policy = await getRecipePermissionPolicy();
    const ctx: PolicyEmitContext = { userId, householdKey };

    emitByPolicy(recipeEmitter, policy.view, ctx, "failed", {
      reason: error.message || "Failed to import recipe",
      recipeId,
      url: "[pasted]",
    });
  }
}

export async function startPasteImportWorker(): Promise<void> {
  await createLazyWorker<PasteImportJobData>(
    QUEUE_NAMES.PASTE_IMPORT,
    processPasteImportJob,
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.PASTE_IMPORT],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.PASTE_IMPORT],
    },
    handleJobFailed
  );
}

export async function stopPasteImportWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.PASTE_IMPORT);
}
