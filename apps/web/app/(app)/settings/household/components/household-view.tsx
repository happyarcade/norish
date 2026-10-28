"use client";

import { useTranslations } from "next-intl";

import HouseholdInfoCard from "./household-info-card";
import HouseholdPeopleCard from "./household-people-card";
import JoinCodeCard from "./join-code-card";
import MembersCard from "./members-card";
import PlannerLayoutCard from "./planner-layout-card";

export default function HouseholdView() {
  const t = useTranslations("settings.household");

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
      <HouseholdInfoCard />
      <PlannerLayoutCard />
      <HouseholdPeopleCard />
      <MembersCard />
      <JoinCodeCard />
    </div>
  );
}
