"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useRecipesContext } from "@/context/recipes-context";
import { readClipboardUrl } from "@/lib/clipboard-url";
import { addToast, closeToast } from "@/lib/ui/toast";
import { useTranslations } from "next-intl";

const PROMPT_TIMEOUT_MS = 15_000;
const OFFERED_STORAGE_KEY = "norish.clipboard-import.offered";

function readOffered(): string | null {
  try {
    return window.sessionStorage.getItem(OFFERED_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberOffered(url: string): void {
  try {
    window.sessionStorage.setItem(OFFERED_STORAGE_KEY, url);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

function isOwnLink(url: string): boolean {
  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function ClipboardImportPrompt() {
  const t = useTranslations("common.import.clipboard");
  const tActions = useTranslations("common.actions");
  const { importRecipe } = useRecipesContext();
  const isReadingRef = useRef(false);
  const latestRef = useRef({ importRecipe, t, tActions });

  useEffect(() => {
    latestRef.current = { importRecipe, t, tActions };
  });

  useEffect(() => {
    let cancelled = false;

    async function offerClipboardLink() {
      if (isReadingRef.current || !document.hasFocus()) return;
      isReadingRef.current = true;

      try {
        const url = await readClipboardUrl();

        if (cancelled || !url || isOwnLink(url) || readOffered() === url) return;

        rememberOffered(url);
        const { t, tActions } = latestRef.current;
        const toastKey = addToast({
          title: t("title"),
          description: <span className="line-clamp-2 break-all">{url}</span>,
          timeout: PROMPT_TIMEOUT_MS,
          shouldShowTimeoutProgress: true,
          radius: "full",
          endContent: (
            <Button
              color="primary"
              radius="full"
              size="sm"
              variant="solid"
              onPress={() => {
                if (toastKey) closeToast(toastKey);
                latestRef.current.importRecipe(url);
              }}
            >
              {tActions("import")}
            </Button>
          ),
        });
      } finally {
        isReadingRef.current = false;
      }
    }

    void offerClipboardLink();
    window.addEventListener("focus", offerClipboardLink);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", offerClipboardLink);
    };
  }, []);

  return null;
}
