"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { InputGroup, InputOTP, Label, REGEXP_ONLY_DIGITS, TextField } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { useHouseholdSettingsContext } from "../context";

export default function NoHouseholdView() {
  const t = useTranslations("settings.household");
  const { createHousehold, joinHousehold } = useHouseholdSettingsContext();
  const [householdName, setHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateHousehold = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await createHousehold(householdName);
      setHouseholdName("");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinHousehold = async (e: FormEvent) => {
    e.preventDefault();
    setIsJoining(true);
    try {
      await joinHousehold(joinCode);
      setJoinCode("");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Create Household */}
        <Card>
          <Card.Header>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <HomeIcon className="h-5 w-5" />
              {t("create.title")}
            </h2>
          </Card.Header>
          <Card.Content>
            <form className="flex flex-col gap-4" onSubmit={handleCreateHousehold}>
              <p className="text-default-600 text-base">{t("create.description")}</p>
              <TextField fullWidth isRequired value={householdName} onChange={setHouseholdName}>
                <Label>{t("create.nameLabel")}</Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input placeholder={t("create.namePlaceholder")} />
                </InputGroup>
              </TextField>
              <div className="flex justify-end">
                <Button isPending={isCreating} type="submit" variant="primary">
                  {t("create.submitButton")}
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>

        {/* Join Household */}
        <Card>
          <Card.Header>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <UserGroupIcon className="h-5 w-5" />
              {t("join.title")}
            </h2>
          </Card.Header>
          <Card.Content>
            <form className="flex flex-col gap-4" onSubmit={handleJoinHousehold}>
              <p className="text-default-600 text-base">{t("join.description")}</p>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("join.codeLabel")}</span>
                <InputOTP
                  required
                  aria-label={t("join.codeLabel")}
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={joinCode}
                  onChange={setJoinCode}
                >
                  <InputOTP.Group className="justify-start">
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTP.Slot key={index} index={index} />
                    ))}
                  </InputOTP.Group>
                </InputOTP>
                <span className="text-default-500 text-xs">{t("join.codePlaceholder")}</span>
              </div>
              <div className="flex justify-end">
                <Button isPending={isJoining} type="submit" variant="primary">
                  {t("join.submitButton")}
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
