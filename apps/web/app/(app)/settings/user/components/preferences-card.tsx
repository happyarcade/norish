"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import NewFeatureChip from "@/app/(app)/settings/components/new-feature-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocaleConfigQuery, useTimersEnabledQuery } from "@/hooks/config";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { InputGroup, Label, ListBox, Select, Switch, TextField } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import type { NutritionFocusMetricKey } from "@norish/shared/contracts/zod/user";
import { NUTRITION_FOCUS_CONFIG } from "@norish/shared/lib/nutrition-focus";
import {
  getFocusNutritionMetricsPreference,
  getLocalePreference,
  getNutritionTargetsPreference,
  getShowConversionButtonPreference,
  getShowFavoritesPreference,
  getShowRatingsPreference,
  getTimersEnabledPreference,
} from "@norish/shared/lib/user-preferences";

import { useUserSettingsContext } from "../context";

function buildThresholdDraftsFromTargets(
  targets: ReturnType<typeof getNutritionTargetsPreference>
) {
  return Object.fromEntries(
    (Object.keys(NUTRITION_FOCUS_CONFIG) as NutritionFocusMetricKey[]).map((metricKey) => {
      const target = targets[metricKey];
      const value = target?.max ?? target?.min;

      return [metricKey, value != null ? String(value) : ""];
    })
  ) as Record<NutritionFocusMetricKey, string>;
}

export default function PreferencesCard() {
  const t = useTranslations("settings.user.preferences");
  const { user, updatePreferences, isUpdatingPreferences } = useUserSettingsContext();
  const { globalEnabled } = useTimersEnabledQuery();
  const { enabledLocales, defaultLocale } = useLocaleConfigQuery();
  const router = useRouter();

  const effective = getTimersEnabledPreference(user);
  const disabled = !globalEnabled;
  const currentLocale = getLocalePreference(user) ?? defaultLocale;
  const conversionEffective = getShowConversionButtonPreference(user);
  const ratingsEffective = getShowRatingsPreference(user);
  const favoritesEffective = getShowFavoritesPreference(user);
  const focusMetrics = useMemo(() => getFocusNutritionMetricsPreference(user), [user]);
  const nutritionTargets = useMemo(() => getNutritionTargetsPreference(user), [user]);
  const savedThresholdDrafts = useMemo(
    () => buildThresholdDraftsFromTargets(nutritionTargets),
    [nutritionTargets]
  );
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<NutritionFocusMetricKey, string>>(
    () => savedThresholdDrafts
  );

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (disabled) return;
      await updatePreferences({ timersEnabled: value });
    },
    [disabled, updatePreferences]
  );

  const handleConversionToggle = useCallback(
    async (value: boolean) => {
      await updatePreferences({ showConversionButton: value });
    },
    [updatePreferences]
  );

  const handleRatingsToggle = useCallback(
    async (value: boolean) => {
      await updatePreferences({ showRatings: value });
    },
    [updatePreferences]
  );

  const handleFavoritesToggle = useCallback(
    async (value: boolean) => {
      await updatePreferences({ showFavorites: value });
    },
    [updatePreferences]
  );

  const handleFocusMetricToggle = useCallback(
    async (metric: NutritionFocusMetricKey) => {
      const nextMetrics = focusMetrics.includes(metric)
        ? focusMetrics.filter((value) => value !== metric)
        : [...focusMetrics, metric];

      await updatePreferences({ focusNutritionMetrics: nextMetrics });
    },
    [focusMetrics, updatePreferences]
  );

  const handleThresholdCommit = useCallback(
    async (metric: NutritionFocusMetricKey) => {
      const config = NUTRITION_FOCUS_CONFIG[metric];
      const rawValue = (thresholdDrafts[metric] ?? savedThresholdDrafts[metric] ?? "").trim();
      const parsedValue = Number.parseFloat(rawValue);
      const fallbackValue = config.defaultThreshold;
      const nextValue = Number.isFinite(parsedValue) ? parsedValue : fallbackValue;

      setThresholdDrafts((current) => ({
        ...current,
        [metric]: String(nextValue),
      }));

      await updatePreferences({
        nutritionTargets: {
          ...nutritionTargets,
          [metric]: config.direction === "min" ? { min: nextValue } : { max: nextValue },
        },
      });
    },
    [nutritionTargets, savedThresholdDrafts, thresholdDrafts, updatePreferences]
  );

  const handleLocaleChange = useCallback(
    async (value: string) => {
      if (!value || value === currentLocale) return;

      await updatePreferences({ locale: value });
      router.refresh();
    },
    [currentLocale, router, updatePreferences]
  );

  const selectedFocusMetrics = useMemo(
    () =>
      (Object.keys(NUTRITION_FOCUS_CONFIG) as NutritionFocusMetricKey[]).filter((metric) =>
        focusMetrics.includes(metric)
      ),
    [focusMetrics]
  );

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <AdjustmentsHorizontalIcon className="h-5 w-5" />
          {t("title")}
          <NewFeatureChip />
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="text-default-500 text-base">{t("description")}</p>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("language.title")}</div>
            <div className="text-default-500 text-sm">{t("language.description")}</div>
          </div>

          <Select
            aria-label={t("language.title")}
            className="max-w-[200px]"
            isDisabled={isUpdatingPreferences || enabledLocales.length === 0}
            selectedKey={currentLocale || null}
            variant="secondary"
            onSelectionChange={(selected) => {
              if (typeof selected === "string") void handleLocaleChange(selected);
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox aria-label={t("language.title")}>
                {enabledLocales.map((locale) => (
                  <ListBox.Item key={locale.code} id={locale.code} textValue={locale.name}>
                    {locale.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        {globalEnabled ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-foreground font-medium">{t("timers.title")}</div>
              <div className="text-default-500 text-sm">{t("timers.description")}</div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                aria-label={t("timers.title")}
                isDisabled={isUpdatingPreferences || disabled}
                isSelected={effective}
                onChange={(value) => void handleToggle(value)}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("conversion.title")}</div>
            <div className="text-default-500 text-sm">{t("conversion.description")}</div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              aria-label={t("conversion.title")}
              isDisabled={isUpdatingPreferences}
              isSelected={conversionEffective}
              onChange={(value) => void handleConversionToggle(value)}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("ratings.title")}</div>
            <div className="text-default-500 text-sm">{t("ratings.description")}</div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              aria-label={t("ratings.title")}
              isDisabled={isUpdatingPreferences}
              isSelected={ratingsEffective}
              onChange={(value) => void handleRatingsToggle(value)}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("favorites.title")}</div>
            <div className="text-default-500 text-sm">{t("favorites.description")}</div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              aria-label={t("favorites.title")}
              isDisabled={isUpdatingPreferences}
              isSelected={favoritesEffective}
              onChange={(value) => void handleFavoritesToggle(value)}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="text-foreground font-medium">{t("nutritionFocus.title")}</div>
            <div className="text-default-500 text-sm">{t("nutritionFocus.description")}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(NUTRITION_FOCUS_CONFIG) as NutritionFocusMetricKey[]).map((metricKey) => {
              const config = NUTRITION_FOCUS_CONFIG[metricKey];
              const isSelected = focusMetrics.includes(metricKey);

              return (
                <Button
                  key={metricKey}
                  className="rounded-full"
                  size="sm"
                  variant={isSelected ? "primary" : "tertiary"}
                  onPress={() => void handleFocusMetricToggle(metricKey)}
                >
                  {config.label}
                </Button>
              );
            })}
          </div>

          {selectedFocusMetrics.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {selectedFocusMetrics.map((metricKey) => {
                const config = NUTRITION_FOCUS_CONFIG[metricKey];

                return (
                  <TextField
                    key={metricKey}
                    fullWidth
                    value={thresholdDrafts[metricKey] ?? savedThresholdDrafts[metricKey] ?? ""}
                    onChange={(nextValue) =>
                      setThresholdDrafts((current) => ({
                        ...current,
                        [metricKey]: nextValue,
                      }))
                    }
                  >
                    <Label>{`${config.label} - ${t(
                      config.direction === "min"
                        ? "nutritionFocus.thresholdLabelMin"
                        : "nutritionFocus.thresholdLabelMax"
                    )}`}</Label>
                    <InputGroup fullWidth className="rounded-2xl" variant="secondary">
                      <InputGroup.Input
                        type="number"
                        onBlur={() => void handleThresholdCommit(metricKey)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                      />
                      <InputGroup.Suffix>
                        <span className="text-default-400 text-xs tracking-[0.12em] uppercase">
                          {config.unit}
                        </span>
                      </InputGroup.Suffix>
                    </InputGroup>
                  </TextField>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("metadataReview.title")}</div>
            <div className="text-default-500 text-sm">{t("metadataReview.description")}</div>
          </div>

          <Button
            className="rounded-full"
            variant="tertiary"
            onPress={() => router.push("/recipes/review")}
          >
            {t("metadataReview.action")}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
