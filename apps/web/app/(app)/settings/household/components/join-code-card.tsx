"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowPathIcon,
  ClipboardDocumentIcon as ClipboardDocumentIconSolid,
} from "@heroicons/react/16/solid";
import { ClipboardDocumentIcon as ClipboardDocumentIconOutline } from "@heroicons/react/24/outline";
import { InputGroup, TextField } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import type { HouseholdAdminSettingsDto } from "@norish/shared/contracts/dto/household";

import { useHouseholdSettingsContext } from "../context";

export default function JoinCodeCard() {
  const t = useTranslations("settings.household.joinCode");
  const { household, currentUserId, regenerateJoinCode } = useHouseholdSettingsContext();
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Calculate time remaining for join code
  useEffect(() => {
    if (
      !household ||
      !("joinCode" in household) ||
      !household.joinCode ||
      !household.joinCodeExpiresAt
    ) {
      setTimeRemaining("");

      return;
    }

    const calculateTime = () => {
      // Type guard again inside the function
      if (!household || !("joinCodeExpiresAt" in household) || !household.joinCodeExpiresAt) return;

      const now = new Date();
      const expires = new Date(household.joinCodeExpiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");

        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeRemaining(`${minutes}m ${seconds}s`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [household]);

  if (!household) return null;

  // Check if current user is admin and if household has admin fields
  const currentUserData = currentUserId
    ? household.users.find((u) => u.id === currentUserId)
    : null;
  const isAdmin = currentUserData?.isAdmin === true;

  // Type guard: only admins get joinCode fields
  const hasJoinCode = "joinCode" in household;

  if (!isAdmin || !hasJoinCode) return null;

  // Now TypeScript knows household has joinCode fields
  const adminHousehold = household as HouseholdAdminSettingsDto;
  const joinCodeExpired = adminHousehold.joinCodeExpiresAt
    ? new Date(adminHousehold.joinCodeExpiresAt) < new Date()
    : true;

  const handleCopyJoinCode = () => {
    // Type guard ensures household has joinCode
    if ("joinCode" in household && household.joinCode) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(household.joinCode);
      }
    }
  };

  const handleRegenerateCode = async () => {
    await regenerateJoinCode(household.id);
  };

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ClipboardDocumentIconOutline className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        {adminHousehold.joinCode && !joinCodeExpired ? (
          <>
            <p className="text-default-600 text-base">{t("shareDescription")}</p>
            <div className="flex gap-2">
              <TextField fullWidth isReadOnly value={adminHousehold.joinCode || ""}>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input className="font-mono text-lg tracking-wider" />
                </InputGroup>
              </TextField>
              <Button isIconOnly aria-label={t("title")} onPress={handleCopyJoinCode}>
                <ClipboardDocumentIconSolid className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-default-600 text-base">
                {t("expiresIn")} <span className="text-warning font-medium">{timeRemaining}</span>
              </span>
              <Button size="sm" variant="secondary" onPress={handleRegenerateCode}>
                <ArrowPathIcon className="h-4 w-4" />
                {t("regenerateButton")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-default-600 text-base">{t("noCodeDescription")}</p>
            <div className="flex justify-end">
              <Button variant="primary" onPress={handleRegenerateCode}>
                <ArrowPathIcon className="h-4 w-4" />
                {t("generateButton")}
              </Button>
            </div>
          </>
        )}
      </Card.Content>
    </Card>
  );
}
