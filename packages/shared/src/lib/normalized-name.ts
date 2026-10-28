/**
 * Fold a grocery name for exact matching while preserving its words.
 */
export function normalizeGroceryName(name: string | null | undefined): string {
  if (!name) return "";

  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
