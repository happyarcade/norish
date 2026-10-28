"use client";

import type { ComputedShoppingProjectionResult } from "@/hooks/groceries/use-computed-shopping-query";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GroceryList,
  GroceryListByRecipe,
  MoveDoneToPantryPanel,
  PantryContent,
  StoreManagerPanel,
} from "@/components/groceries";
import { AddGroceryPanel } from "@/components/Panel/consumers";
import EditGroceryPanel from "@/components/Panel/consumers/edit-grocery-panel";
import GrocerySkeleton from "@/components/skeleton/grocery-skeleton";
import { Button } from "@/components/ui/button";
import { useComputedShoppingQuery } from "@/hooks/groceries/use-computed-shopping-query";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  BookOpenIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  CheckIcon,
  Cog6ToothIcon,
  HomeIcon,
  PlusIcon,
} from "@heroicons/react/16/solid";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { Dropdown, Header, Label, Separator, Tabs, toast } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, PantryIngredientDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { addWeeks, dateKey, getWeekStart } from "@norish/shared/lib/helpers";

import { useGroceriesContext, useGroceriesUIContext } from "../context";
import { useStoresContext } from "../stores-context";
import AddGroceryButton from "./add-grocery-button";
import { ComputedShoppingSection } from "./computed-shopping-section";

const SHOPPING_WEEK_START_KEY = "norish:shopping-window-start";

function validateShoppingWeekStart(data: unknown): string | null {
  if (typeof data !== "string") return null;

  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
}

function currentWeekStartISO(): string {
  return dateKey(getWeekStart(new Date()));
}

function shiftWeekStart(isoDate: string, weeks: number): string {
  return dateKey(addWeeks(new Date(`${isoDate}T00:00:00`), weeks));
}

export function GroceriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = searchParams.get("tab") === "pantry" ? "pantry" : "shopping";
  const [pantryTransferStoreId, setPantryTransferStoreId] = useState<string | null | undefined>(
    undefined
  );
  const {
    groceries,
    recurringGroceries,
    recipeMap,
    isLoading,
    toggleGroceries,
    deleteGroceries,
    createGrocery,
    createRecurringGrocery,
    updateGrocery,
    updateRecurringGrocery,
    deleteRecurringGrocery,
    assignGroceryToStore,
    reorderGroceriesInStore,
    getRecurringGroceryForGrocery,
    markAllDoneInStore,
    deleteDoneInStore,
    getRecipeNameForGrocery,
    createGroceriesFromData,
    moveDoneToPantry,
  } = useGroceriesContext();

  const { stores, storeManagerOpen, setStoreManagerOpen } = useStoresContext();

  const {
    addGroceryPanelOpen,
    setAddGroceryPanelOpen,
    editingGrocery,
    setEditingGrocery,
    viewMode,
    setViewMode,
    groupSimilarIngredients,
    setGroupSimilarIngredients,
  } = useGroceriesUIContext();

  const t = useTranslations("groceries.page");
  const tPantryTransfer = useTranslations("groceries.pantryTransfer");
  const shoppingWindowDays = 28 as const;
  const [shoppingWindowStart, setShoppingWindowStart] = useLocalStorage<string>(
    SHOPPING_WEEK_START_KEY,
    currentWeekStartISO(),
    validateShoppingWeekStart
  );
  const isCurrentShoppingWeek = shoppingWindowStart === currentWeekStartISO();
  const {
    data: shoppingProjection,
    isLoading: shoppingProjectionLoading,
    error: shoppingProjectionError,
  } = useComputedShoppingQuery({
    dayCount: shoppingWindowDays,
    windowStart: shoppingWindowStart,
  });

  const handlePreviousShoppingWeek = useCallback(() => {
    setShoppingWindowStart((current) => shiftWeekStart(current, -1));
  }, [setShoppingWindowStart]);

  const handleNextShoppingWeek = useCallback(() => {
    setShoppingWindowStart((current) => shiftWeekStart(current, 1));
  }, [setShoppingWindowStart]);

  const handleResetShoppingWeek = useCallback(() => {
    setShoppingWindowStart(currentWeekStartISO());
  }, [setShoppingWindowStart]);

  const handleSectionChange = useCallback(
    (key: React.Key) => {
      const section = key === "pantry" ? "pantry" : "shopping";
      const params = new URLSearchParams(searchParams.toString());

      if (section === "shopping") params.delete("tab");
      else params.set("tab", section);

      const query = params.toString();

      router.replace(query ? `/groceries?${query}` : "/groceries", { scroll: false });
    },
    [router, searchParams]
  );

  const handleAddPantryItem = useCallback(
    async (item: ComputedShoppingProjectionResult["pantryItems"][number]) => {
      await createGroceriesFromData([
        {
          name: item.name,
          amount: item.qty > 0 ? item.qty : null,
          unit: item.unit && item.unit !== "unit" ? item.unit : null,
          isDone: false,
        },
      ]);
    },
    [createGroceriesFromData]
  );

  const handleAddLowPantryItem = useCallback(
    async (item: PantryIngredientDto) => {
      await createGroceriesFromData([{ name: item.name }]);
    },
    [createGroceriesFromData]
  );

  const handleToggle = (id: string, isDone: boolean) => {
    toggleGroceries([id], isDone);
  };

  const handleToggleGroup = (ids: string[], isDone: boolean) => {
    toggleGroceries(ids, isDone);
  };

  const handleEdit = (grocery: GroceryDto) => {
    setEditingGrocery(grocery);
  };

  const handleDelete = (id: string) => {
    deleteGroceries([id]);
  };

  const handleMoveDoneToPantry = async (groceryIds: string[]) => {
    const result = await moveDoneToPantry(groceryIds);

    toast.success(tPantryTransfer("success", { count: result.movedCount }));
  };

  // Edit panel handlers
  const editingRecurringGrocery = editingGrocery
    ? getRecurringGroceryForGrocery(editingGrocery.id)
    : null;

  const handleEditSave = (itemName: string, pattern: RecurrencePattern | null) => {
    if (!editingGrocery) return;

    if (editingRecurringGrocery) {
      // Already recurring - update the recurring grocery
      updateRecurringGrocery(editingRecurringGrocery.id, editingGrocery.id, itemName, pattern);
    } else if (pattern) {
      // Convert regular grocery to recurring
      updateGrocery(editingGrocery.id, itemName);
      createRecurringGrocery(itemName, pattern, editingGrocery.storeId);
      deleteGroceries([editingGrocery.id]);
    } else {
      // Simple update
      updateGrocery(editingGrocery.id, itemName);
    }
  };

  const handleEditAssignToStore = (storeId: string | null, savePreference?: boolean) => {
    if (!editingGrocery) return;
    assignGroceryToStore(editingGrocery.id, storeId, savePreference);
  };

  const handleEditDelete = () => {
    if (!editingGrocery) return;

    if (editingRecurringGrocery) {
      deleteRecurringGrocery(editingRecurringGrocery.id);
    } else {
      deleteGroceries([editingGrocery.id]);
    }
    setEditingGrocery(null);
  };

  if (isLoading) {
    return <GrocerySkeleton />;
  }

  const hasManualListData = groceries.length > 0 || recurringGroceries.length > 0;
  const completedGroceriesForTransfer =
    pantryTransferStoreId === undefined
      ? []
      : groceries.filter((grocery) => grocery.isDone && grocery.storeId === pantryTransferStoreId);

  return (
    <>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        {/* Header */}
        <div className="mb-4 flex min-h-10 shrink-0 items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          {activeSection === "shopping" ? (
            <div className="flex items-center gap-2">
              {/* Desktop add button: Full text with icon */}
              <Button
                className="hidden rounded-full font-medium md:flex"
                size="md"
                variant="primary"
                onPress={() => setAddGroceryPanelOpen(true)}
              >
                <PlusIcon className="h-5 w-5" />
                {t("addItem")}
              </Button>
              {/* Settings dropdown with view mode and store management */}
              <Dropdown>
                <Button isIconOnly aria-label={t("viewMode")} size="sm" variant="tertiary">
                  <Cog6ToothIcon className="h-5 w-5" />
                </Button>
                <Dropdown.Popover placement="bottom end">
                  <Dropdown.Menu aria-label={t("viewMode")}>
                    <Dropdown.Section>
                      <Header>{t("viewMode")}</Header>
                      <Dropdown.Item
                        id="view-planner"
                        textValue="By Planner"
                        onAction={() => setViewMode("planner")}
                      >
                        <CalendarDaysIcon className="h-4 w-4" />
                        <Label className="flex-1">By Planner</Label>
                        {viewMode === "planner" ? (
                          <CheckIcon className="text-primary h-4 w-4" />
                        ) : null}
                      </Dropdown.Item>
                      <Dropdown.Item
                        id="view-store"
                        textValue={t("viewByStore")}
                        onAction={() => setViewMode("store")}
                      >
                        <BuildingStorefrontIcon className="h-4 w-4" />
                        <Label className="flex-1">{t("viewByStore")}</Label>
                        {viewMode === "store" ? (
                          <CheckIcon className="text-primary h-4 w-4" />
                        ) : null}
                      </Dropdown.Item>
                      <Dropdown.Item
                        id="view-recipe"
                        textValue={t("viewByRecipe")}
                        onAction={() => setViewMode("recipe")}
                      >
                        <BookOpenIcon className="h-4 w-4" />
                        <Label className="flex-1">{t("viewByRecipe")}</Label>
                        {viewMode === "recipe" ? (
                          <CheckIcon className="text-primary h-4 w-4" />
                        ) : null}
                      </Dropdown.Item>
                    </Dropdown.Section>

                    {viewMode === "store" ? (
                      <>
                        <Separator />
                        <Dropdown.Section>
                          <Header>{t("storeViewOptions")}</Header>
                          <Dropdown.Item
                            id="group-similar"
                            textValue={t("groupIngredients")}
                            onAction={() => setGroupSimilarIngredients(!groupSimilarIngredients)}
                          >
                            <Label className="flex-1">{t("groupIngredients")}</Label>
                            {groupSimilarIngredients ? (
                              <CheckIcon className="text-primary h-4 w-4" />
                            ) : null}
                          </Dropdown.Item>
                        </Dropdown.Section>
                      </>
                    ) : null}

                    <Separator />
                    <Dropdown.Section>
                      <Dropdown.Item
                        id="manage-stores"
                        textValue={t("manageStores")}
                        onAction={() => setStoreManagerOpen(true)}
                      >
                        <Cog6ToothIcon className="h-4 w-4" />
                        <Label>{t("manageStores")}</Label>
                      </Dropdown.Item>
                    </Dropdown.Section>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
          ) : null}
        </div>

        <Tabs
          className="flex min-h-0 flex-1 flex-col"
          selectedKey={activeSection}
          variant="secondary"
          onSelectionChange={handleSectionChange}
        >
          <Tabs.ListContainer className="shrink-0 overflow-x-auto">
            <Tabs.List aria-label={t("sectionLabel")} className="min-w-fit">
              <Tabs.Tab className="h-11 min-w-32" id="shopping">
                <Tabs.Indicator />
                <ShoppingCartIcon className="h-5 w-5" />
                <span>{t("shopping")}</span>
              </Tabs.Tab>
              <Tabs.Tab className="h-11 min-w-32" id="pantry">
                <Tabs.Indicator />
                <HomeIcon className="h-5 w-5" />
                <span>{t("pantry")}</span>
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel className="mt-5 min-h-0 flex-1" id="shopping">
            <div className="flex min-h-full flex-col">
              <ComputedShoppingSection
                data={shoppingProjection}
                error={shoppingProjectionError}
                isCurrentWeek={isCurrentShoppingWeek}
                isLoading={shoppingProjectionLoading}
                stores={stores}
                viewMode={viewMode}
                windowStart={shoppingWindowStart}
                onAddPantryItem={handleAddPantryItem}
                onNextWeek={handleNextShoppingWeek}
                onPreviousWeek={handlePreviousShoppingWeek}
                onResetWeek={handleResetShoppingWeek}
              />

              <div className="mb-4">
                <div className="text-default-400 mb-1 text-[11px] font-semibold tracking-[0.18em] uppercase">
                  Manual Items
                </div>
                <div className="text-foreground text-base font-semibold">
                  Extras and recurring groceries
                </div>
              </div>

              {/* Grocery list */}
              <div className="flex-1 overflow-y-auto">
                {!hasManualListData ? (
                  <div className="flex flex-col items-center justify-center px-4 py-14">
                    <div className="bg-content1/90 shadow-large border-default-200/70 relative w-full max-w-xl rounded-xl border backdrop-blur-xl">
                      <div className="flex flex-col items-center gap-5 p-8 text-center">
                        <div className="bg-primary-500/15 text-primary-500 flex h-14 w-14 items-center justify-center rounded-2xl">
                          <ShoppingCartIcon className="h-6 w-6" />
                        </div>
                        <div className="text-foreground text-base font-semibold">
                          No manual items yet
                        </div>
                      </div>
                    </div>
                  </div>
                ) : viewMode === "recipe" ? (
                  <GroceryListByRecipe
                    groceries={groceries}
                    recipeMap={recipeMap}
                    recurringGroceries={recurringGroceries}
                    stores={stores}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onReorder={reorderGroceriesInStore}
                    onToggle={handleToggle}
                  />
                ) : (
                  <GroceryList
                    getRecipeNameForGrocery={getRecipeNameForGrocery}
                    groceries={groceries}
                    groupSimilarIngredients={groupSimilarIngredients}
                    recurringGroceries={recurringGroceries}
                    stores={stores}
                    onDelete={handleDelete}
                    onDeleteDoneInStore={deleteDoneInStore}
                    onEdit={handleEdit}
                    onMarkAllDoneInStore={markAllDoneInStore}
                    onMoveDoneToPantry={setPantryTransferStoreId}
                    onReorderInStore={reorderGroceriesInStore}
                    onToggle={handleToggle}
                    onToggleGroup={handleToggleGroup}
                  />
                )}
              </div>

              {/* Mobile: Floating add button that syncs with nav auto-hide */}
              <AddGroceryButton />
            </div>
          </Tabs.Panel>

          <Tabs.Panel className="mt-5 min-h-0 flex-1" id="pantry">
            <PantryContent
              groceryNames={groceries
                .filter((grocery) => !grocery.isDone)
                .map((grocery) => grocery.name)}
              open={activeSection === "pantry"}
              variant="page"
              onAddToGroceries={handleAddLowPantryItem}
            />
          </Tabs.Panel>
        </Tabs>
      </div>

      {/* Panels */}
      <AddGroceryPanel
        open={addGroceryPanelOpen}
        stores={stores}
        onCreate={createGrocery}
        onCreateRecurring={createRecurringGrocery}
        onOpenChange={setAddGroceryPanelOpen}
      />

      <StoreManagerPanel
        open={storeManagerOpen}
        stores={stores}
        onOpenChange={setStoreManagerOpen}
      />

      <MoveDoneToPantryPanel
        groceries={completedGroceriesForTransfer}
        open={pantryTransferStoreId !== undefined}
        onMove={handleMoveDoneToPantry}
        onOpenChange={(open) => !open && setPantryTransferStoreId(undefined)}
      />

      {editingGrocery && (
        <EditGroceryPanel
          grocery={editingGrocery}
          open={!!editingGrocery}
          recurringGrocery={editingRecurringGrocery}
          stores={stores}
          onAssignToStore={handleEditAssignToStore}
          onDelete={handleEditDelete}
          onOpenChange={(open) => !open && setEditingGrocery(null)}
          onSave={handleEditSave}
        />
      )}
    </>
  );
}
