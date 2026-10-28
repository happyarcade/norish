"use client";

import { useEffect, useRef, useState } from "react";
import { addToast } from "@/lib/ui/toast";
import { DevicePhoneMobileIcon } from "@heroicons/react/20/solid";
import { useTranslations } from "next-intl";

import { useWakeLockContext } from "./wake-lock-context";

export default function WakeLockToggle() {
  const { isSupported, isActive, toggle } = useWakeLockContext();
  const t = useTranslations("recipes.wakeLock");
  const [isPending, setIsPending] = useState(false);
  const autoEnableAttempted = useRef(false);

  useEffect(() => {
    if (!isSupported || isActive || autoEnableAttempted.current) return;

    autoEnableAttempted.current = true;
    void Promise.resolve(toggle());
  }, [isActive, isSupported, toggle]);

  const handleToggle = async () => {
    if (isPending) return;

    if (!isSupported) {
      addToast({
        color: "warning",
        description: "Mobile browsers usually require HTTPS for this feature.",
        radius: "full",
        title: t("notSupported"),
      });

      return;
    }

    setIsPending(true);

    try {
      await toggle();
    } finally {
      setIsPending(false);
    }
  };

  const title = !isSupported
    ? t("notSupported")
    : isActive
      ? t("activeTooltip")
      : t("inactiveTooltip");

  return (
    <button
      aria-checked={isActive}
      aria-label={t("ariaLabel")}
      aria-disabled={!isSupported || isPending}
      className={`relative z-20 flex touch-manipulation items-center gap-2 rounded-full px-1 py-1 transition active:scale-95 ${
        isSupported ? "text-default-600 hover:text-foreground" : "text-default-400 opacity-70"
      }`}
      disabled={isPending}
      role="switch"
      title={title}
      type="button"
      onClick={handleToggle}
    >
      <DevicePhoneMobileIcon className="h-5 w-5" />
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          isActive ? "bg-success" : "bg-default-200"
        } ${isPending ? "opacity-70" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            isActive ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
