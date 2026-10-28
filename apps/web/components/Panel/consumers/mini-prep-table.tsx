"use client";

import type { PrepSessionResult } from "@/hooks/prep";
import { memo, useCallback, useMemo } from "react";
import Panel from "@/components/Panel/Panel";
import { useIsDesktop } from "@/components/planner/use-is-desktop";
import { Button } from "@/components/ui/button";
import { useHouseholdQuery } from "@/hooks/households/use-household-query";
import { usePrepMutations, usePrepRangeQuery } from "@/hooks/prep";
import { ArchiveBoxIcon, PlusIcon } from "@heroicons/react/16/solid";
import { Modal, Separator, Spinner, useOverlayState } from "@heroui-v3/react";
import { useLocale } from "next-intl";

import { dateKey, eachDayOfInterval } from "@norish/shared/lib/helpers";

type MiniPrepTableProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);

  next.setDate(next.getDate() + days);

  return next;
}

function formatDateLabel(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

const MiniPrepDay = memo(function MiniPrepDay({
  date,
  sessions,
  locale,
  isSaving,
  onAdd,
}: {
  date: string;
  sessions: PrepSessionResult[];
  locale: string;
  isSaving: boolean;
  onAdd: (date: string) => void;
}) {
  const parsedDate = useMemo(() => new Date(`${date}T12:00:00`), [date]);
  const isToday = date === dateKey(new Date());
  const items = sessions.flatMap((session) => session.items);

  return (
    <div className="border-default-100 border-b last:border-none">
      <div className="bg-background hover:bg-default-50/50 flex flex-col gap-3 px-4 py-4 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
            {formatDateLabel(parsedDate, locale)}
          </div>

          <Button
            isIconOnly
            aria-label="Add to Prep Table"
            className="bg-default-100 text-default-500 hover:text-primary h-8 min-w-8 rounded-full shadow-sm transition-transform active:scale-95"
            isDisabled={isSaving}
            size="sm"
            variant="tertiary"
            onPress={() => onAdd(date)}
          >
            {isSaving ? <Spinner size="sm" /> : <PlusIcon className="h-4 w-4" />}
          </Button>
        </div>

        <Separator className="my-1" />

        <div className="flex w-full flex-col gap-2">
          {items.length === 0 ? (
            <span className="text-default-400 text-xs italic">No prep planned</span>
          ) : (
            items.map((item) => {
              const title = item.recipe?.name ?? "Recipe unavailable";

              return (
                <div key={item.id} className="flex w-full items-start gap-3 py-1">
                  <div className="bg-default-100 border-default-100 relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border">
                    {item.recipe?.image ? (
                      // Imported recipes can use arbitrary remote image hosts.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={title}
                        className="h-full w-full object-cover"
                        src={item.recipe.image}
                      />
                    ) : (
                      <div className="text-default-400 flex h-full w-full items-center justify-center">
                        <ArchiveBoxIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-foreground truncate text-sm font-medium" title={title}>
                      {title}
                    </span>
                    <span className="text-default-400 text-xs">
                      {item.batchCount} {item.batchCount === 1 ? "batch" : "batches"}
                      {item.isFreezerBatch ? " - freezer" : ""}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});

function MiniPrepTableContent({
  open,
  recipeId,
  onOpenChange,
}: {
  open: boolean;
  recipeId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const locale = useLocale();
  const householdQuery = useHouseholdQuery();
  const today = useMemo(() => new Date(), []);
  const rangeStart = useMemo(() => dateKey(today), [today]);
  const rangeEnd = useMemo(() => dateKey(addDays(today, 27)), [today]);
  const range = useMemo(
    () => ({ startDate: rangeStart, endDate: rangeEnd }),
    [rangeEnd, rangeStart]
  );
  const prepQuery = usePrepRangeQuery(range, {
    enabled: open && Boolean(householdQuery.household),
  });
  const prepMutations = usePrepMutations({ queryKey: prepQuery.queryKey });
  const days = useMemo(
    () =>
      eachDayOfInterval(new Date(`${rangeStart}T12:00:00`), new Date(`${rangeEnd}T12:00:00`)).map(
        (date) => dateKey(date)
      ),
    [rangeEnd, rangeStart]
  );
  const sessionsByDate = useMemo(() => {
    return (prepQuery.data?.sessions ?? []).reduce<Record<string, PrepSessionResult[]>>(
      (acc, session) => {
        const bucket = acc[session.date] ?? (acc[session.date] = []);

        bucket.push(session);

        return acc;
      },
      {}
    );
  }, [prepQuery.data?.sessions]);

  const handleAdd = useCallback(
    async (date: string) => {
      await prepMutations.addRecipe({
        date,
        recipeId,
        batchCount: 1,
        isFreezerBatch: false,
        notes: null,
      });
      onOpenChange(false);
    },
    [onOpenChange, prepMutations, recipeId]
  );

  if (householdQuery.isLoading || prepQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (!householdQuery.household) {
    return (
      <div className="text-default-500 flex flex-1 items-center justify-center p-8 text-center text-sm">
        Create a household before adding recipes to the Prep Table.
      </div>
    );
  }

  if (prepQuery.error) {
    return (
      <div className="text-danger flex flex-1 items-center justify-center p-8 text-center text-sm">
        Prep Table failed to load.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {days.map((day) => (
        <MiniPrepDay
          key={day}
          date={day}
          isSaving={prepMutations.isSaving}
          locale={locale}
          sessions={sessionsByDate[day] ?? []}
          onAdd={handleAdd}
        />
      ))}
    </div>
  );
}

export default function MiniPrepTable({ open, onOpenChange, recipeId }: MiniPrepTableProps) {
  const isDesktop = useIsDesktop();
  const title = "Add to Prep Table";
  const modalState = useOverlayState({ isOpen: open, onOpenChange });
  const content = open ? (
    <MiniPrepTableContent open={open} recipeId={recipeId} onOpenChange={onOpenChange} />
  ) : null;

  if (isDesktop) {
    return (
      <Modal state={modalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" scroll="inside" size="lg">
            <Modal.Dialog className="max-w-lg">
              <Modal.CloseTrigger aria-label="Close prep table" />
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="max-h-[72vh] overflow-y-auto p-0">{content}</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <Panel height={82} open={open} title={title} onOpenChange={onOpenChange}>
      <div className="flex min-h-0 flex-1 flex-col">{content}</div>
    </Panel>
  );
}
