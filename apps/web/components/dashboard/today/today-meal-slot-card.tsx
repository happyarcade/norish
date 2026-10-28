"use client";

import { useRouter } from "next/navigation";
import FallbackImage from "@/components/shared/fallback-image";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PlusIcon } from "@heroicons/react/16/solid";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import type { TodayMealSlotCardProps } from "./todays-meals-types";
import { buildPlannerItemSubtitle, getPlannerItemTitle } from "./todays-meals-helpers";
import TodaysMealsSlotChip from "./todays-meals-slot-chip";

const cardClassName = "h-[184px] w-[144px] shrink-0 overflow-hidden rounded-xl sm:w-[152px]";
const triggerClassName =
  "group relative grid h-full min-h-0 w-full min-w-0 grid-rows-[132px_52px] overflow-hidden rounded-xl border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
const mediaClassName = "bg-default-100 relative h-[132px] w-full overflow-hidden";
const imageClassName =
  "absolute inset-0 block h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105";
const imageFallbackClassName =
  "bg-default-100 text-default-500 absolute inset-0 flex h-full w-full items-center justify-center transition-transform duration-300 group-hover:scale-105";
const slotChipPositionClassName = "absolute top-2 left-2 z-20 max-w-[calc(100%-1rem)]";
const constrainedSlotChipPositionClassName = "absolute top-2 left-2 z-20 max-w-[calc(100%-4.5rem)]";
const slotChipClassName = "bg-content1/85 text-foreground backdrop-blur";
const remainingChipClassName =
  "absolute top-2 right-2 z-10 inline-flex w-fit bg-content1/85 text-foreground backdrop-blur";

export default function TodayMealSlotCard({
  slotKey,
  slotLabel,
  items,
  onPlan,
  isDisabled = false,
}: TodayMealSlotCardProps) {
  const router = useRouter();
  const tCalendar = useTranslations("calendar.timeline");
  const tCalendarPanel = useTranslations("calendar.panel");
  const primaryItem = items[0];
  const remainingCount = Math.max(items.length - 1, 0);
  const isPlanned = Boolean(primaryItem);
  const emptySlotDisabled = !isPlanned && isDisabled;
  const imageSrc = primaryItem?.recipe?.image ?? null;
  const title = getPlannerItemTitle(primaryItem, tCalendar("untitled"));
  const subtitle = buildPlannerItemSubtitle(primaryItem, {
    note: tCalendar("note"),
    serving: tCalendar("serving"),
    servings: tCalendar("servings"),
  });

  const handleOpen = () => {
    if (primaryItem?.recipe?.id) {
      router.push(`/recipes/${primaryItem.recipe.id}`);

      return;
    }

    if (!primaryItem) {
      if (!emptySlotDisabled) onPlan(slotKey);

      return;
    }

    router.push("/calendar");
  };

  return (
    <Card className={`${cardClassName} ${isPlanned ? "" : "bg-default-50"}`} radius="lg">
      <button
        aria-label={isPlanned ? title : `${tCalendarPanel("addRecipe")} ${slotLabel}`}
        className={`${triggerClassName} ${emptySlotDisabled ? "cursor-default opacity-60" : "cursor-pointer"}`}
        disabled={emptySlotDisabled}
        type="button"
        onClick={handleOpen}
      >
        <div
          className={
            remainingCount > 0 ? constrainedSlotChipPositionClassName : slotChipPositionClassName
          }
        >
          <TodaysMealsSlotChip
            className={slotChipClassName}
            slotKey={slotKey}
            slotLabel={slotLabel}
          />
        </div>

        {isPlanned ? (
          <>
            <div className={mediaClassName}>
              {imageSrc ? (
                <FallbackImage
                  removeWrapper
                  alt={title}
                  className={imageClassName}
                  fallbackClassName={imageFallbackClassName}
                  fallbackMessage={tCalendar("noImage")}
                  radius="none"
                  src={imageSrc}
                  variant="hero"
                />
              ) : (
                <div className={imageFallbackClassName}>
                  <PhotoIcon aria-hidden="true" className="h-10 w-10 opacity-70" />
                </div>
              )}

              {remainingCount > 0 ? (
                <Chip className={remainingChipClassName} radius="full" size="sm" variant="flat">
                  +{remainingCount}
                </Chip>
              ) : null}
            </div>

            <Card.Content className="flex h-[52px] w-full flex-col justify-start gap-0.5 overflow-hidden px-2.5 py-1.5">
              <span
                className="text-foreground w-full min-w-0 truncate text-left text-xs leading-[15px] font-semibold"
                title={title}
              >
                {title}
              </span>
              {subtitle ? (
                <span className="text-default-500 w-full min-w-0 truncate text-left text-[10px] leading-3">
                  {subtitle}
                </span>
              ) : null}
            </Card.Content>
          </>
        ) : (
          <>
            <div className={mediaClassName} />
            <div className="bg-default-100 h-[52px] w-full" />
            <div className="text-default-500 pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 pt-7 text-center">
              <PlusIcon className="h-6 w-6" />
              <span className="text-foreground text-xs font-medium">
                {tCalendarPanel("addRecipe")}
              </span>
            </div>
          </>
        )}
      </button>
    </Card>
  );
}
