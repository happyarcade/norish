import { isUrl } from "@norish/shared/lib/helpers";

export async function readClipboardUrl(): Promise<string | null> {
  if (typeof navigator === "undefined" || typeof navigator.clipboard?.readText !== "function") {
    return null;
  }

  try {
    const text = (await navigator.clipboard.readText()).trim();

    return isUrl(text) ? text : null;
  } catch {
    return null;
  }
}
