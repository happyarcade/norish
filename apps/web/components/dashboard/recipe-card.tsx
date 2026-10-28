"use client";

import type { MouseEvent } from "react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MiniCalendar, MiniGroceries } from "@/components/Panel/consumers";
import { formatCookHistoryShort } from "@/components/recipes/cook-history";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { usePermissionsContext } from "@/context/permissions-context";
import { useUserContext } from "@/context/user-context";
import { useRecipePrefetch } from "@/hooks/recipes/use-recipe-prefetch";
import { useAppStore } from "@/stores/useAppStore";
import {
  CalendarDaysIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  ShoppingBagIcon,
  StarIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/20/solid";
import { useTranslations } from "next-intl";

import { RecipeDashboardDTO } from "@norish/shared/contracts";
import { formatMinutesHM } from "@norish/shared/lib/helpers";
import {
  getShowFavoritesPreference,
  getShowRatingsPreference,
} from "@norish/shared/lib/user-preferences";

import { DeleteRecipeModal } from "../shared/delete-recipe-modal";
import DoubleTapContainer from "../shared/double-tap-container";
import FallbackImage from "../shared/fallback-image";
import HeartButton from "../shared/heart-button";
import SwipeableRow, { SwipeableRowRef, SwipeAction } from "../shared/swipable-row";
import RecipeMetadata from "./recipe-metadata";
import RecipeTags from "./recipe-tags";

type RecipeCardProps = {
  recipe: RecipeDashboardDTO;
  isFavorite: boolean;
  allergies: string[];
  variant?: "grid" | "list";
  onToggleFavorite: (recipeId: string) => void;
  onDelete: (recipeId: string) => void;
};

type RecipeTagValue = { name?: string | null } | string | null | undefined;

function normalizeRecipeTagNames(tags: readonly RecipeTagValue[] | null | undefined) {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const tag of tags ?? []) {
    const name = (typeof tag === "string" ? tag : tag?.name)?.trim();

    if (!name) continue;

    const key = name.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    names.push(name);
  }

  return names;
}

function getRecipeTagsSignature(tags: RecipeDashboardDTO["tags"] | null | undefined) {
  return normalizeRecipeTagNames(tags).join("\u0000");
}

function RecipeCardComponent({
  recipe,
  isFavorite: recipeIsFavorite,
  allergies,
  variant = "grid",
  onToggleFavorite,
  onDelete,
}: RecipeCardProps) {
  const router = useRouter();
  const rowRef = useRef<SwipeableRowRef>(null);
  const mobileSearchOpen = useAppStore((s) => s.mobileSearchOpen);
  const { canDeleteRecipe } = usePermissionsContext();
  const { user } = useUserContext();
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [groceriesOpen, setGroceriesOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const onDeleteModalOpen = () => setDeleteModalOpen(true);
  const onDeleteModalClose = () => setDeleteModalOpen(false);
  const t = useTranslations("recipes.card");
  const showRatings = getShowRatingsPreference(user);
  const showFavorites = getShowFavoritesPreference(user);

  const cardRef = useRecipePrefetch(recipe.id);

  const averageRating = recipe.averageRating ?? null;

  const handleNavigate = useCallback(() => {
    if (recipe.id && !open && !mobileSearchOpen) {
      router.push(`/recipes/${recipe.id}`);
    }
  }, [router, recipe.id, open, mobileSearchOpen]);

  const totalMinutes =
    recipe.totalMinutes ?? ((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || undefined);
  const timeLabel = formatMinutesHM(totalMinutes);

  const servings = recipe.servings;
  const allTags = recipe.tags ?? [];
  const tagNames = useMemo(() => normalizeRecipeTagNames(recipe.tags), [recipe.tags]);
  const visibleTagNames = tagNames.slice(0, 2);
  const hiddenTagCount = tagNames.length - visibleTagNames.length;
  const description = recipe.description?.trim() || "";
  const cookHistoryLabel = formatCookHistoryShort(recipe.lastCookedAt, recipe.cookCount);
  const thumbnailImage = recipe.image;

  function _canClick() {
    return !open && !mobileSearchOpen;
  }

  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite(recipe.id);
  }, [onToggleFavorite, recipe.id]);

  const handleDeleteClick = useCallback(() => {
    onDeleteModalOpen();
    setTimeout(() => rowRef.current?.openRow(), 0);
  }, [onDeleteModalOpen]);

  const stopParentActivation = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    onDeleteModalClose();
    rowRef.current?.triggerDeleteAnimation(() => {
      onDelete(recipe.id);
    });
  }, [onDelete, recipe.id, onDeleteModalClose]);

  const showDeleteAction = recipe.userId ? canDeleteRecipe(recipe.userId) : true;

  const actions: SwipeAction[] = useMemo(() => {
    const baseActions: SwipeAction[] = [
      {
        key: "groceries",
        icon: ShoppingBagIcon,
        color: "blue",
        onPress: () => setGroceriesOpen(true),
        label: t("viewGroceries"),
      },
      {
        key: "calendar",
        icon: CalendarDaysIcon,
        color: "yellow",
        onPress: () => setCalendarOpen(true),
        label: t("addToCalendar"),
      },
    ];

    if (showDeleteAction) {
      baseActions.push({
        key: "delete",
        icon: TrashIcon,
        color: "danger",
        onPress: handleDeleteClick,
        primary: false,
        label: t("deleteRecipe"),
      });
    }

    return baseActions;
  }, [showDeleteAction, handleDeleteClick, t]);

  const optionsButton = (
    <div role="presentation" onClick={stopParentActivation}>
      <Button
        isIconOnly
        aria-label={t("recipeOptions")}
        className="text-default-500 h-8 w-8 min-w-0 shrink-0 rounded-full p-0"
        size="sm"
        title={t("recipeOptions")}
        type="button"
        variant="light"
        onPress={() => {
          if (rowRef.current?.isOpen()) rowRef.current?.closeRow();
          else rowRef.current?.openRow();
        }}
      >
        <EllipsisHorizontalIcon className="h-5 w-5" />
      </Button>
    </div>
  );

  const listMetadata = (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 overflow-hidden">
      {typeof averageRating === "number" && averageRating > 0 && showRatings && (
        <Chip
          className="shrink-0 px-2 text-[11px]"
          radius="full"
          size="sm"
          startContent={<StarIcon className="text-warning h-3.5 w-3.5" />}
          variant="flat"
        >
          {Math.round(averageRating)}
        </Chip>
      )}

      {timeLabel && (
        <Chip
          className="shrink-0 px-2 text-[11px]"
          radius="full"
          size="sm"
          startContent={<ClockIcon className="h-3.5 w-3.5" />}
          variant="flat"
        >
          {timeLabel}
        </Chip>
      )}

      {typeof servings === "number" && servings > 0 && (
        <Chip
          className="shrink-0 px-2 text-[11px]"
          radius="full"
          size="sm"
          startContent={<UserGroupIcon className="h-3.5 w-3.5" />}
          variant="flat"
        >
          {servings}
        </Chip>
      )}

      {visibleTagNames.map((tag) => (
        <Chip key={tag.toLowerCase()} className="max-w-[8rem] px-2 text-[11px]" size="sm">
          <span className="truncate">{tag}</span>
        </Chip>
      ))}

      {hiddenTagCount > 0 && (
        <Chip
          className="shrink-0 px-2 text-[11px]"
          radius="full"
          size="sm"
          title={tagNames.join(", ")}
          variant="flat"
        >
          +{hiddenTagCount}
        </Chip>
      )}
    </div>
  );

  const listCard = (
    <div
      ref={cardRef}
      data-recipe-card
      className={`relative h-[128px] w-full overflow-hidden transition-all duration-300 ${open ? "rounded-none opacity-70" : "rounded-xl"} `}
      role="button"
      tabIndex={open ? 0 : -1}
      onClick={() => {
        if (open) rowRef.current?.closeRow();
        else handleNavigate();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (open) rowRef.current?.closeRow();
          else handleNavigate();
        }
      }}
    >
      <div className="group/row relative h-full w-full">
        <Card
          className="border-default-200 h-full w-full overflow-hidden border shadow-sm"
          radius="lg"
        >
          <div className="flex h-full min-w-0 items-stretch">
            <div role="presentation" onClick={stopParentActivation}>
              <DoubleTapContainer
                className="bg-default-100 relative h-full w-[112px] shrink-0 cursor-pointer overflow-hidden"
                disabled={open || mobileSearchOpen}
                doubleTapEnabled={showFavorites}
                onDoubleTap={() => {
                  if (showFavorites) handleToggleFavorite();
                }}
                onSingleTap={handleNavigate}
              >
                {thumbnailImage ? (
                  <FallbackImage
                    removeWrapper
                    alt={recipe.name}
                    className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover/row:scale-105"
                    fallbackClassName="h-full w-full transition-transform duration-300 ease-in-out group-hover/row:scale-105"
                    fallbackMessage={t("noImage")}
                    radius="none"
                    src={thumbnailImage}
                    variant="hero"
                  />
                ) : (
                  <div className="bg-default-200 text-default-500 flex h-full w-full items-center justify-center">
                    <span className="px-3 text-center text-xs font-medium opacity-70">
                      {t("noImage")}
                    </span>
                  </div>
                )}

                {showFavorites && (
                  <div className="pointer-events-auto absolute top-2 left-2 z-20">
                    <HeartButton
                      hideWhenNotFavorite
                      showBackground
                      isFavorite={recipeIsFavorite}
                      size="sm"
                      onToggle={handleToggleFavorite}
                    />
                  </div>
                )}
              </DoubleTapContainer>
            </div>

            <Card.Content className="relative flex h-full min-w-0 flex-1 flex-col justify-center py-3 pr-12 pl-4">
              <h3
                className={`text-foreground truncate text-base leading-5 font-semibold ${open ? "" : "group-hover/row:underline"} `}
                title={recipe.name}
              >
                {recipe.name}
              </h3>
              {description && (
                <p className="text-default-500 mt-1 truncate text-sm" title={description}>
                  <SmartMarkdownRenderer disableLinks text={description} />
                </p>
              )}

              <div className="mt-3">{listMetadata}</div>
              {cookHistoryLabel ? (
                <p className="text-default-400 mt-1 truncate text-xs">{cookHistoryLabel}</p>
              ) : null}
              <div className="absolute top-1/2 right-3 -translate-y-1/2">{optionsButton}</div>
            </Card.Content>
          </div>
        </Card>
      </div>
    </div>
  );

  const gridCard = (
    <div
      ref={cardRef}
      data-recipe-card
      className={`relative w-full overflow-hidden transition-all duration-300 ${open ? "rounded-none opacity-70" : "rounded-xl"} `}
      role="button"
      tabIndex={open ? 0 : -1}
      onClick={() => {
        if (open) rowRef.current?.closeRow();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && open) {
          e.preventDefault();
          rowRef.current?.closeRow();
        }
      }}
    >
      <div className="group/row relative w-full">
        <Card
          className="relative w-full bg-transparent shadow-none focus-visible:outline-none"
          radius="none"
        >
          <DoubleTapContainer
            className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden"
            disabled={open || mobileSearchOpen}
            doubleTapEnabled={showFavorites}
            onDoubleTap={() => {
              if (showFavorites) handleToggleFavorite();
            }}
            onSingleTap={handleNavigate}
          >
            <div className="pointer-events-none absolute inset-0 z-0">
              {thumbnailImage ? (
                <FallbackImage
                  removeWrapper
                  alt={recipe.name}
                  className={`h-full w-full object-cover transition-transform duration-300 ease-in-out ${open ? "scale-100" : "group-hover/row:scale-110"} `}
                  fallbackClassName={`transition-all duration-300 ease-in-out ${open ? "scale-100" : "group-hover/row:scale-105"}`}
                  fallbackMessage={t("noImage")}
                  radius="none"
                  src={thumbnailImage}
                  variant="hero"
                />
              ) : (
                <div
                  className={`bg-default-200 text-default-500 flex h-full w-full items-center justify-center transition-all duration-300 ease-in-out ${open ? "scale-100" : "group-hover/row:scale-105"} `}
                >
                  <span className="text-sm font-medium opacity-70">{t("noImage")}</span>
                </div>
              )}
            </div>

            <RecipeMetadata
              averageRating={showRatings ? averageRating : null}
              isFavorite={recipeIsFavorite}
              servings={servings}
              timeLabel={timeLabel}
              onOptionsPress={() => {
                if (rowRef.current?.isOpen()) rowRef.current?.closeRow();
                else rowRef.current?.openRow();
              }}
              onToggleFavorite={showFavorites ? handleToggleFavorite : undefined}
            />

            {allTags.length > 0 && <RecipeTags allergies={allergies} tags={allTags} />}
          </DoubleTapContainer>

          <Card.Content className="cursor-pointer py-3 pr-3 pl-0" onClick={handleNavigate}>
            <h3
              className={`text-foreground truncate text-base font-semibold ${open ? "" : "group-hover/row:underline"} `}
              title={recipe.name}
            >
              {recipe.name}
            </h3>

            {description && (
              <p
                className="text-default-500 mt-1 text-sm"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
                title={description}
              >
                <SmartMarkdownRenderer disableLinks text={description} />
              </p>
            )}

            {cookHistoryLabel ? (
              <p className="text-default-400 mt-1 text-xs">{cookHistoryLabel}</p>
            ) : null}
          </Card.Content>
        </Card>
      </div>
    </div>
  );

  return (
    <>
      <SwipeableRow
        ref={rowRef}
        actions={actions}
        disableSwipeOnDesktop={true}
        onOpenChange={setOpen}
      >
        {variant === "list" ? listCard : gridCard}
      </SwipeableRow>

      <MiniCalendar open={calendarOpen} recipeId={recipe.id} onOpenChange={setCalendarOpen} />

      <MiniGroceries
        initialServings={recipe.servings || 1}
        open={groceriesOpen}
        originalServings={recipe.servings || 1}
        recipeId={recipe.id}
        onOpenChange={setGroceriesOpen}
      />

      <DeleteRecipeModal
        isOpen={isDeleteModalOpen}
        recipeName={recipe.name}
        onClose={onDeleteModalClose}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

const RecipeCard = memo(RecipeCardComponent, (prevProps, nextProps) => {
  if (prevProps.isFavorite !== nextProps.isFavorite) return false;
  if (prevProps.allergies !== nextProps.allergies) return false;
  if (prevProps.variant !== nextProps.variant) return false;
  if (prevProps.onToggleFavorite !== nextProps.onToggleFavorite) return false;
  if (prevProps.onDelete !== nextProps.onDelete) return false;

  const prev = prevProps.recipe;
  const next = nextProps.recipe;
  const prevLastCookedAt = prev.lastCookedAt ? new Date(prev.lastCookedAt).getTime() : null;
  const nextLastCookedAt = next.lastCookedAt ? new Date(next.lastCookedAt).getTime() : null;

  return (
    prev.id === next.id &&
    prev.name === next.name &&
    prev.description === next.description &&
    prev.image === next.image &&
    prev.servings === next.servings &&
    prev.prepMinutes === next.prepMinutes &&
    prev.cookMinutes === next.cookMinutes &&
    prev.totalMinutes === next.totalMinutes &&
    prev.averageRating === next.averageRating &&
    prevLastCookedAt === nextLastCookedAt &&
    prev.cookCount === next.cookCount &&
    prev.updatedAt?.getTime() === next.updatedAt?.getTime() &&
    getRecipeTagsSignature(prev.tags) === getRecipeTagsSignature(next.tags)
  );
});

RecipeCard.displayName = "RecipeCard";

export default RecipeCard;
