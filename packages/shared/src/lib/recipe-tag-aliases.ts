const RECIPE_TAG_ALIAS_PATTERNS: Record<string, RegExp> = {
  "slow cooker": /\b(?:slow[\s-]?cooker|crock[\s-]?pot)\b/i,
};

export function isAliasedRecipeTag(tagName: string): boolean {
  return tagName.toLowerCase() in RECIPE_TAG_ALIAS_PATTERNS;
}

export function getCanonicalCookingMethodTags(values: readonly string[]): string[] {
  const corpus = values.join(" \n ");

  return Object.entries(RECIPE_TAG_ALIAS_PATTERNS)
    .filter(([, pattern]) => pattern.test(corpus))
    .map(([tagName]) => tagName);
}

export function matchesRecipeTagFilter(
  candidateTags: Iterable<string>,
  requestedTag: string
): boolean {
  const normalizedRequestedTag = requestedTag.toLowerCase();
  const aliasPattern = RECIPE_TAG_ALIAS_PATTERNS[normalizedRequestedTag];

  for (const candidateTag of candidateTags) {
    if (aliasPattern?.test(candidateTag) || candidateTag.toLowerCase() === normalizedRequestedTag) {
      return true;
    }
  }

  return false;
}
