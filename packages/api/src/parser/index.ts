import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { extractRecipeWithAI } from "@norish/api/ai/recipe-parser";
import { isVideoUrl } from "@norish/api/helpers";
import {
  extractRecipeNodesFromJsonLd,
  tryExtractRecipeFromJsonLd,
} from "@norish/api/parser/jsonld";
import {
  extractMicrodataRecipes,
  tryExtractRecipeFromMicrodata,
} from "@norish/api/parser/microdata";
import {
  getContentIndicators,
  isAIEnabled,
  isVideoParsingEnabled,
  shouldAlwaysUseAI,
} from "@norish/config/server-config-loader";
import { parserLogger as log } from "@norish/shared-server/logger";
import { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";

import { fetchViaPlaywright } from "./fetch";

export interface ImportedRecipeSource {
  sourceType: "schema_org" | "scraped" | "url_import" | "video_import";
  sourceUrl: string | null;
  sourceDomain: string | null;
  siteName: string | null;
  author: string | null;
  language: string | null;
  rawPayload: unknown;
}

export interface ParseRecipeResult {
  recipe: FullRecipeInsertDTO;
  /** Whether AI was used for extraction (affects auto-tagging) */
  usedAI: boolean;
  source: ImportedRecipeSource;
}

function buildRecipeSnapshot(recipe: FullRecipeInsertDTO) {
  const ingredients = recipe.recipeIngredients ?? [];
  const steps = recipe.steps ?? [];

  return {
    name: recipe.name,
    url: recipe.url ?? null,
    categories: recipe.categories ?? [],
    servings: recipe.servings ?? null,
    ingredientLines: ingredients
      .map((ingredient) => ingredient.rawLine ?? ingredient.ingredientName ?? null)
      .filter(Boolean),
    stepCount: steps.length,
  };
}

function getSourceDomain(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
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

    return (
      readTextValue(record.name) ??
      readTextValue(record.text) ??
      readTextValue(record["@value"]) ??
      readTextValue(record.caption)
    );
  }

  return null;
}

function buildStructuredSource(
  url: string,
  sourceType: ImportedRecipeSource["sourceType"],
  rawPayload: unknown
): ImportedRecipeSource {
  const sourceDomain = getSourceDomain(url);
  const record =
    rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : null;

  return {
    sourceType,
    sourceUrl: url,
    sourceDomain,
    siteName: readTextValue(record?.publisher) ?? readTextValue(record?.isPartOf) ?? sourceDomain,
    author: readTextValue(record?.author),
    language: readTextValue(record?.inLanguage),
    rawPayload,
  };
}

function buildImportedSource(
  url: string,
  sourceType: ImportedRecipeSource["sourceType"],
  rawPayload: unknown
): ImportedRecipeSource {
  const sourceDomain = getSourceDomain(url);

  return {
    sourceType,
    sourceUrl: url,
    sourceDomain,
    siteName: sourceDomain,
    author: null,
    language: null,
    rawPayload,
  };
}

/**
 * Checks if a parsed recipe has valid ingredients and steps.
 * Used to determine if structured parsing was successful.
 */
function hasValidRecipeData(recipe: FullRecipeInsertDTO | null): recipe is FullRecipeInsertDTO {
  return (
    !!recipe &&
    Array.isArray(recipe.recipeIngredients) &&
    recipe.recipeIngredients.length > 0 &&
    Array.isArray(recipe.steps) &&
    recipe.steps.length > 0
  );
}

/**
 * Attempt AI extraction. If requireAI = true, throws when AI is disabled.
 */
async function tryExtractWithAI(
  input: string,
  recipeId: string,
  url: string,
  allergies: string[] | undefined,
  requireAI: boolean,
  originalHtml?: string
): Promise<FullRecipeInsertDTO | null> {
  const enabled = await isAIEnabled();

  if (!enabled) {
    if (requireAI) {
      throw new Error("AI-only import requested but AI is not enabled.");
    }

    return null;
  }

  log.info({ url }, "Attempting AI extraction");
  const result = await extractRecipeWithAI(input, recipeId, url, allergies, originalHtml);

  if (result.success) return result.data;

  log.warn({ url, error: result.error, code: result.code }, "AI extraction failed");

  return null;
}

/**
 * Try AI extraction with smallest/cleanest input first (JSON-LD),
 * then fall back to full HTML.
 */
async function extractWithAIPreference(
  html: string,
  recipeId: string,
  url: string,
  allergies: string[] | undefined,
  requireAI: boolean
): Promise<FullRecipeInsertDTO | null> {
  const jsonLdNodes = extractRecipeNodesFromJsonLd(html);

  if (jsonLdNodes.length > 0) {
    log.info({ url }, "AI: using extracted JSON-LD as input (fewer tokens)");
    const jsonLdInput = JSON.stringify(jsonLdNodes, null, 2);

    const fromJsonLd = await tryExtractWithAI(
      jsonLdInput,
      recipeId,
      url,
      allergies,
      requireAI,
      html
    );

    if (fromJsonLd) return fromJsonLd;
  }

  log.info({ url }, "AI: using full HTML as input");

  return tryExtractWithAI(html, recipeId, url, allergies, requireAI, html);
}

/**
 * Attempts structured parsing using JSON-LD and microdata extractors.
 * Returns recipe if either parser produces valid data, null otherwise.
 */
async function tryStructuredParsers(
  url: string,
  html: string,
  recipeId: string
): Promise<ParseRecipeResult | null> {
  const jsonLdNodes = extractRecipeNodesFromJsonLd(html);

  if (jsonLdNodes.length > 0) {
    const jsonLdParsed = await tryExtractRecipeFromJsonLd(url, html, recipeId);

    if (hasValidRecipeData(jsonLdParsed)) {
      return {
        recipe: jsonLdParsed,
        usedAI: false,
        source: buildStructuredSource(url, "schema_org", jsonLdNodes[0]),
      };
    }
  }

  const microdataNodes = extractMicrodataRecipes(html);

  if (microdataNodes.length > 0) {
    const microParsed = await tryExtractRecipeFromMicrodata(url, html, recipeId);

    if (hasValidRecipeData(microParsed)) {
      return {
        recipe: microParsed,
        usedAI: false,
        source: buildStructuredSource(url, "scraped", microdataNodes[0]),
      };
    }
  }

  return null;
}

/**
 * Handles video URL parsing (YouTube, Instagram, TikTok, etc.).
 * Returns ParseRecipeResult if URL is a video, null if not a video URL.
 * Throws if video parsing is disabled or processing fails.
 */
async function tryHandleVideoUrl(
  url: string,
  recipeId: string,
  allergies?: string[],
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<ParseRecipeResult | null> {
  if (!isVideoUrl(url)) return null;

  if (!(await isVideoParsingEnabled())) {
    throw new Error("Video recipe parsing is not enabled.");
  }

  try {
    const { processVideoRecipe } = await import("@norish/api/video/processor");
    const recipe = await processVideoRecipe(url, recipeId, allergies, tokens);

    return {
      recipe,
      usedAI: true,
      source: buildImportedSource(url, "video_import", {
        extractionMethod: "video",
        recipe: buildRecipeSnapshot(recipe),
      }),
    };
  } catch (error: unknown) {
    log.error({ err: error }, "Video processing failed");
    throw error;
  }
}

export async function parseRecipeFromUrl(
  url: string,
  recipeId: string,
  allergies?: string[],
  forceAI?: boolean,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<ParseRecipeResult> {
  const videoResult = await tryHandleVideoUrl(url, recipeId, allergies, tokens);

  if (videoResult) return videoResult;

  const html = await fetchViaPlaywright(url, tokens);

  if (!html) throw new Error("Cannot fetch recipe page.");

  if (!(await isPageLikelyRecipe(html))) {
    throw new Error("Page does not appear to contain a recipe.");
  }

  const useAIOnly = forceAI ?? (await shouldAlwaysUseAI());
  const jsonLdNodes = extractRecipeNodesFromJsonLd(html);
  const microdataNodes = extractMicrodataRecipes(html);

  if (useAIOnly) {
    const recipe = await extractWithAIPreference(html, recipeId, url, allergies, true);

    if (!recipe) throw new Error("AI extraction failed");

    return {
      recipe,
      usedAI: true,
      source: buildImportedSource(
        url,
        "url_import",
        jsonLdNodes.length > 0
          ? {
              extractionMethod: "ai_jsonld",
              primaryNode: jsonLdNodes[0],
              recipe: buildRecipeSnapshot(recipe),
            }
          : {
              extractionMethod: "ai_html",
              recipe: buildRecipeSnapshot(recipe),
            }
      ),
    };
  }

  const structured = await tryStructuredParsers(url, html, recipeId);

  if (structured) return structured;

  const recipe = await extractWithAIPreference(html, recipeId, url, allergies, false);

  if (recipe) {
    return {
      recipe,
      usedAI: true,
      source: buildImportedSource(url, "url_import", {
        extractionMethod: jsonLdNodes.length > 0 ? "ai_jsonld_fallback" : "ai_html_fallback",
        structuredCandidates: {
          jsonLdCount: jsonLdNodes.length,
          microdataCount: microdataNodes.length,
        },
        recipe: buildRecipeSnapshot(recipe),
      }),
    };
  }

  log.error({ url }, "All extraction methods failed");
  throw new Error("Cannot parse recipe.");
}

export async function isPageLikelyRecipe(html: string): Promise<boolean> {
  const lowered = html.toLowerCase();
  const indicators = await getContentIndicators();

  const hasSchema = indicators.schemaIndicators.some((i) => lowered.includes(i.toLowerCase()));
  const contentHits = indicators.contentIndicators.filter((i) =>
    lowered.includes(i.toLowerCase())
  ).length;

  return hasSchema || contentHits >= 2;
}
export { normalizeRecipeFromSchemaJson } from "./schema-json";
export { classifyDairyAdaptation } from "./parsers/dairy";
export type { DairyAdaptationResult, DairyAdaptationStatus } from "./parsers/dairy";
export type {
  SchemaJsonImportResult,
  SchemaJsonImportSource,
  SchemaJsonPlannerProfile,
} from "./schema-json";
