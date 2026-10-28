const SUSPICIOUS_MOJIBAKE_PATTERN = /(?:Ã|Â|â[\u0080-\u00bf]|ï¿½|áº|Ì)/;
const ENCODED_BYTE_RUN_PATTERN = /[\u0080-\u00ff]{2,4}/g;

export function hasMojibake(value: string): boolean {
  return SUSPICIOUS_MOJIBAKE_PATTERN.test(value);
}

export function repairMojibakeText(value: string): string {
  if (!hasMojibake(value)) return value;

  let repaired = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = repaired.replace(ENCODED_BYTE_RUN_PATTERN, (run) => {
      try {
        const bytes = Uint8Array.from(Array.from(run, (character) => character.charCodeAt(0)));
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return run;
      }
    });

    if (next === repaired) break;
    repaired = next;
  }

  return repaired;
}

export function repairMojibakeValue<T>(value: T): T {
  if (typeof value === "string") return repairMojibakeText(value) as T;
  if (Array.isArray(value)) return value.map((entry) => repairMojibakeValue(entry)) as T;
  if (value == null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, repairMojibakeValue(entry)])
  ) as T;
}
