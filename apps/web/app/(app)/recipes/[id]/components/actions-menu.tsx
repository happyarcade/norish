"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { MiniCalendar, MiniGroceries, MiniPrepTable } from "@/components/Panel/consumers";
import { MarkCookedModal } from "@/components/recipes/mark-cooked-modal";
import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";
import { Button } from "@/components/ui/button";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesContext } from "@/context/recipes-context";
import { useActiveAllergies } from "@/hooks/user";
import { addToast } from "@/lib/ui/toast";
import {
  ArchiveBoxIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  DevicePhoneMobileIcon,
  EllipsisHorizontalIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Dropdown } from "@heroui-v3/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { cssAIGradientText, cssAIIconColor, cssButtonPill } from "@norish/web/config/css-tokens";

import { useRecipeContextRequired } from "../context";
import { useWakeLockContext } from "./wake-lock-context";

type Props = { id: string };

type MenuItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  className?: string;
  labelClassName?: string;
  iconClassName?: string;
  isDisabled?: boolean;
};

export default function ActionsMenu({ id }: Props) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [openCalendar, setOpenCalendar] = React.useState(false);
  const [openGroceries, setOpenGroceries] = React.useState(false);
  const [openMarkCooked, setOpenMarkCooked] = React.useState(false);
  const [openPrepTable, setOpenPrepTable] = React.useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const markCookedMutation = useMutation(trpc.recipes.markCooked.mutationOptions());
  const removeLastCookedMutation = useMutation(trpc.recipes.removeLastCooked.mutationOptions());
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const onDeleteModalOpen = () => setDeleteModalOpen(true);
  const onDeleteModalClose = () => setDeleteModalOpen(false);
  const router = useRouter();
  const { canEditRecipe, canDeleteRecipe, isAutoTaggingEnabled, isAIEnabled } =
    usePermissionsContext();
  const { deleteRecipe } = useRecipesContext();
  const {
    recipe,
    isAutoTagging,
    triggerAutoTag,
    isCategorizing,
    triggerAutoCategorize,
    isDetectingAllergies,
    triggerAllergyDetection,
    isEstimatingNutrition,
    estimateNutrition,
  } = useRecipeContextRequired();
  const { allergies } = useActiveAllergies();
  const { isSupported, isActive, toggle } = useWakeLockContext();
  const t = useTranslations("recipes.actions");

  const canEdit = recipe.userId ? canEditRecipe(recipe.userId) : true;
  const canDelete = recipe.userId ? canDeleteRecipe(recipe.userId) : true;
  const recipesListBaseKey = React.useMemo(() => [trpc.recipes.list.queryKey({})[0]], [trpc]);

  const handleMarkCooked = React.useCallback(
    async (cookedAt: Date) => {
      try {
        await markCookedMutation.mutateAsync({ cookedAt, recipeId: id, source: "recipe_detail" });
        addToast({
          color: "success",
          title: "Marked as cooked",
          description: recipe.name,
          radius: "full",
        });
        queryClient.invalidateQueries({ queryKey: trpc.recipes.get.queryKey({ id }) });
        queryClient.invalidateQueries({ queryKey: recipesListBaseKey });
      } catch (error) {
        addToast({
          color: "danger",
          title: "Could not mark cooked",
          description: "Please try again.",
          radius: "full",
        });
        throw error;
      }
    },
    [id, markCookedMutation, queryClient, recipe.name, recipesListBaseKey, trpc]
  );

  const handleRemoveLastCooked = React.useCallback(async () => {
    try {
      await removeLastCookedMutation.mutateAsync({ recipeId: id });
      addToast({
        color: "success",
        title: "Removed last cooked entry",
        description: recipe.name,
        radius: "full",
      });
      queryClient.invalidateQueries({ queryKey: trpc.recipes.get.queryKey({ id }) });
      queryClient.invalidateQueries({ queryKey: recipesListBaseKey });
    } catch (error) {
      addToast({
        color: "danger",
        title: "Could not remove cook history",
        description: "Please try again.",
        radius: "full",
      });
      throw error;
    }
  }, [id, queryClient, recipe.name, recipesListBaseKey, removeLastCookedMutation, trpc]);

  const handleDeleteClick = React.useCallback(() => {
    onDeleteModalOpen();
  }, [onDeleteModalOpen]);

  const handleWakeLockToggle = React.useCallback(async () => {
    if (!isSupported) {
      addToast({
        color: "warning",
        description: "Mobile browsers usually require HTTPS for this feature.",
        radius: "full",
        title: "Keep screen on unavailable",
      });

      return;
    }

    await toggle();
  }, [isSupported, toggle]);

  const handleDeleteConfirm = React.useCallback(() => {
    onDeleteModalClose();
    deleteRecipe(id);
    router.push("/");
  }, [deleteRecipe, id, router, onDeleteModalClose]);

  const menuItems = useMemo(() => {
    const items: MenuItem[] = [
      {
        key: "plan",
        label: t("plan"),
        icon: <CalendarDaysIcon className="size-4" />,
        onPress: () => setOpenCalendar(true),
      },
      {
        key: "groceries",
        label: t("groceries"),
        icon: <ShoppingCartIcon className="size-4" />,
        onPress: () => setOpenGroceries(true),
      },
      {
        key: "prep-table",
        label: "Prep Table",
        icon: <ArchiveBoxIcon className="size-4" />,
        onPress: () => setOpenPrepTable(true),
      },
      {
        key: "mark-cooked",
        label: markCookedMutation.isPending ? "Marking cooked" : "Mark cooked",
        icon: <CheckCircleIcon className="size-4" />,
        onPress: () => setOpenMarkCooked(true),
        isDisabled: markCookedMutation.isPending,
      },
    ];

    if ((recipe.cookCount ?? 0) > 0) {
      items.push({
        key: "remove-last-cooked",
        label: removeLastCookedMutation.isPending ? "Removing cooked entry" : "Remove last cooked",
        icon: <NoSymbolIcon className="size-4" />,
        onPress: () => {
          void handleRemoveLastCooked();
        },
        isDisabled: removeLastCookedMutation.isPending,
      });
    }

    if (canEdit) {
      items.push({
        key: "edit",
        label: t("edit"),
        icon: <PencilSquareIcon className="size-4" />,
        onPress: () => router.push(`/recipes/edit/${id}`),
      });
    }

    items.push({
      key: "wake-lock",
      label: isActive ? t("screenOn") : t("keepScreenOn"),
      icon: <DevicePhoneMobileIcon className="size-4" />,
      onPress: handleWakeLockToggle,
      labelClassName: isActive ? "text-success" : "",
      iconClassName: isActive
        ? "text-success"
        : isSupported
          ? "text-default-400"
          : "text-default-300",
    });

    if (isAutoTaggingEnabled && canEdit) {
      items.push({
        key: "auto-tag",
        label: isAutoTagging ? t("autoTagging") : t("autoTag"),
        icon: <SparklesIcon className="size-4" />,
        onPress: triggerAutoTag,
        labelClassName: cssAIGradientText,
        iconClassName: cssAIIconColor,
        isDisabled: isAutoTagging,
      });
    }

    if (isAIEnabled && canEdit) {
      items.push({
        key: "auto-categorize",
        label: t("autoCategorize"),
        icon: <SparklesIcon className="size-4" />,
        onPress: () => triggerAutoCategorize(),
        labelClassName: cssAIGradientText,
        iconClassName: cssAIIconColor,
        isDisabled: isCategorizing,
      });
    }

    // Show allergy detection when AI is enabled, user can edit, and allergies are configured
    const hasAllergies = allergies.length > 0;

    if (isAIEnabled && canEdit && hasAllergies) {
      items.push({
        key: "detect-allergies",
        label: isDetectingAllergies ? t("detectingAllergies") : t("detectAllergies"),
        icon: <SparklesIcon className="size-4" />,
        onPress: triggerAllergyDetection,
        labelClassName: cssAIGradientText,
        iconClassName: cssAIIconColor,
        isDisabled: isDetectingAllergies,
      });
    }

    // Show nutrition estimation when AI is enabled and user can edit
    if (isAIEnabled && canEdit) {
      items.push({
        key: "estimate-nutrition",
        label: isEstimatingNutrition ? t("estimatingNutrition") : t("estimateNutrition"),
        icon: <SparklesIcon className="size-4" />,
        onPress: estimateNutrition,
        labelClassName: cssAIGradientText,
        iconClassName: cssAIIconColor,
        isDisabled: isEstimatingNutrition,
      });
    }

    if (canDelete) {
      items.push({
        key: "delete",
        label: t("delete"),
        icon: <TrashIcon className="size-4" />,
        onPress: handleDeleteClick,
        labelClassName: "text-danger",
        iconClassName: "text-danger",
      });
    }

    return items;
  }, [
    canEdit,
    canDelete,
    handleDeleteClick,
    id,
    router,
    isSupported,
    isActive,
    handleWakeLockToggle,
    t,
    isAutoTaggingEnabled,
    isAutoTagging,
    triggerAutoTag,
    isAIEnabled,
    allergies,
    isDetectingAllergies,
    triggerAllergyDetection,
    isEstimatingNutrition,
    estimateNutrition,
    isCategorizing,
    triggerAutoCategorize,
    markCookedMutation.isPending,
    recipe.cookCount,
    removeLastCookedMutation.isPending,
    handleRemoveLastCooked,
  ]);

  return (
    <>
      <Dropdown isOpen={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <Button
          isIconOnly
          aria-label={t("actionsLabel")}
          className="transition active:scale-95"
          size="sm"
          variant="light"
        >
          <EllipsisHorizontalIcon className="text-default-500 h-5 w-5" />
        </Button>

        <Dropdown.Popover className="z-[500]" placement="bottom end">
          <Dropdown.Menu aria-label={t("actionsLabel")} items={menuItems}>
            {(item: MenuItem) => (
              <Dropdown.Item
                id={item.key}
                className="py-1 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
              >
                <Button
                  className={`w-full justify-start bg-transparent ${cssButtonPill} ${item.className ?? ""}`}
                  isDisabled={item.isDisabled}
                  radius="full"
                  size="md"
                  startContent={
                    <span className={item.iconClassName ?? "text-default-400"}>{item.icon}</span>
                  }
                  variant="light"
                  onPress={() => {
                    setIsDropdownOpen(false);
                    item.onPress();
                  }}
                >
                  <span className={`text-sm font-medium ${item.labelClassName ?? ""}`}>
                    {item.label}
                  </span>
                </Button>
              </Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <MiniGroceries open={openGroceries} recipeId={id} onOpenChange={setOpenGroceries} />

      <MiniCalendar open={openCalendar} recipeId={id} onOpenChange={setOpenCalendar} />

      <MiniPrepTable open={openPrepTable} recipeId={id} onOpenChange={setOpenPrepTable} />

      <MarkCookedModal
        isOpen={openMarkCooked}
        isSaving={markCookedMutation.isPending}
        recipeId={id}
        recipeName={recipe.name}
        onConfirm={handleMarkCooked}
        onOpenChange={setOpenMarkCooked}
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
