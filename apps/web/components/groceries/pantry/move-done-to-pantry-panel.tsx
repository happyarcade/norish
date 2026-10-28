"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "@/components/Panel/Panel";
import { useIsDesktop } from "@/components/planner/use-is-desktop";
import { Button } from "@/components/ui/button";
import { usePantryQuery } from "@/hooks/pantry";
import { HomeIcon } from "@heroicons/react/16/solid";
import { Checkbox, Label, Modal, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, PantryIngredientDto } from "@norish/shared/contracts";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

type PantryTransferCandidate = {
  key: string;
  name: string;
  groceryIds: string[];
  alreadyInPantry: boolean;
};

type MoveDoneToPantryPanelProps = {
  groceries: GroceryDto[];
  open: boolean;
  onMove: (groceryIds: string[]) => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

export function buildPantryTransferCandidates(
  groceries: readonly GroceryDto[],
  pantryItems: readonly PantryIngredientDto[]
): PantryTransferCandidate[] {
  const pantryNames = new Set(
    pantryItems.filter((item) => item.status === "on_hand").map((item) => item.normalizedName)
  );
  const candidates = new Map<string, PantryTransferCandidate>();

  for (const grocery of groceries) {
    if (!grocery.isDone) continue;

    const name = grocery.name?.trim() ?? "";
    const key = normalizeGroceryName(name);

    if (!key) continue;

    const existing = candidates.get(key);

    if (existing) {
      existing.groceryIds.push(grocery.id);
    } else {
      candidates.set(key, {
        key,
        name,
        groceryIds: [grocery.id],
        alreadyInPantry: pantryNames.has(key),
      });
    }
  }

  return [...candidates.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export function MoveDoneToPantryPanel({
  groceries,
  open,
  onMove,
  onOpenChange,
}: MoveDoneToPantryPanelProps) {
  const t = useTranslations("groceries.pantryTransfer");
  const tActions = useTranslations("common.actions");
  const isDesktop = useIsDesktop();
  const { items: pantryItems, isLoading: pantryLoading } = usePantryQuery();
  const candidates = useMemo(
    () => buildPantryTransferCandidates(groceries, pantryItems),
    [groceries, pantryItems]
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalState = useOverlayState({ isOpen: open, onOpenChange });

  useEffect(() => {
    if (!open) return;

    setSelectedKeys(new Set(candidates.map((candidate) => candidate.key)));
    setError(null);
  }, [candidates, open]);

  const selectedCandidates = candidates.filter((candidate) => selectedKeys.has(candidate.key));
  const selectedGroceryIds = selectedCandidates.flatMap((candidate) => candidate.groceryIds);
  const allSelected = candidates.length > 0 && selectedKeys.size === candidates.length;

  const setCandidateSelected = (key: string, selected: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);

      if (selected) next.add(key);
      else next.delete(key);

      return next;
    });
  };

  const handleMove = async () => {
    if (selectedGroceryIds.length === 0 || isMoving) return;

    setIsMoving(true);
    setError(null);

    try {
      await onMove(selectedGroceryIds);
      onOpenChange(false);
    } catch {
      setError(t("failed"));
    } finally {
      setIsMoving(false);
    }
  };

  const content = (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="bg-default-100/70 flex items-start gap-3 rounded-lg px-4 py-3">
        <HomeIcon className="text-primary mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-default-600 text-sm leading-5">{t("description")}</p>
      </div>

      {pantryLoading ? (
        <p className="text-default-500 py-8 text-center text-sm">{t("loading")}</p>
      ) : candidates.length === 0 ? (
        <p className="text-default-500 py-8 text-center text-sm">{t("empty")}</p>
      ) : (
        <>
          <Checkbox
            isIndeterminate={selectedKeys.size > 0 && !allSelected}
            isSelected={allSelected}
            variant="secondary"
            onChange={(selected) =>
              setSelectedKeys(
                selected ? new Set(candidates.map((candidate) => candidate.key)) : new Set()
              )
            }
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label className="font-medium">{t("selectAll")}</Label>
            </Checkbox.Content>
          </Checkbox>

          <div className="border-default-200 divide-default-100 max-h-[46vh] divide-y overflow-y-auto rounded-lg border">
            {candidates.map((candidate) => (
              <Checkbox
                key={candidate.key}
                className="w-full px-4 py-3"
                isSelected={selectedKeys.has(candidate.key)}
                variant="secondary"
                onChange={(selected) => setCandidateSelected(candidate.key, selected)}
              >
                <Checkbox.Content className="w-full items-center gap-3">
                  <Checkbox.Control className="shrink-0">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Label className="block truncate text-sm font-medium">{candidate.name}</Label>
                      {candidate.groceryIds.length > 1 ? (
                        <p className="text-default-500 text-xs">
                          {t("completedEntries", { count: candidate.groceryIds.length })}
                        </p>
                      ) : null}
                    </div>
                    {candidate.alreadyInPantry ? (
                      <span className="bg-success-100 text-success-700 shrink-0 rounded-full px-2 py-1 text-xs font-medium">
                        {t("alreadyInPantry")}
                      </span>
                    ) : null}
                  </div>
                </Checkbox.Content>
              </Checkbox>
            ))}
          </div>
        </>
      )}

      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
  const actions = (
    <>
      <Button isDisabled={isMoving} variant="tertiary" onPress={() => onOpenChange(false)}>
        {tActions("cancel")}
      </Button>
      <Button
        isDisabled={selectedGroceryIds.length === 0 || pantryLoading}
        isPending={isMoving}
        variant="primary"
        onPress={() => void handleMove()}
      >
        <HomeIcon className="h-4 w-4" />
        {t("confirm", { count: selectedGroceryIds.length })}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Modal state={modalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" scroll="inside" size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label={tActions("close")} />
              <Modal.Header>
                <Modal.Heading>{t("title")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>{content}</Modal.Body>
              <Modal.Footer>{actions}</Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      <div className="flex h-full min-h-0 flex-col gap-5">
        <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
        <div className="flex shrink-0 justify-end gap-2 pb-2">{actions}</div>
      </div>
    </Panel>
  );
}
