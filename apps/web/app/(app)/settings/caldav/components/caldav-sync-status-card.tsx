"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PopoverButtonTrigger } from "@/components/ui/overlay-button-trigger";
import { ArrowPathIcon, ClockIcon, InformationCircleIcon } from "@heroicons/react/16/solid";
import { Pagination, Popover, Table } from "@heroui-v3/react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";

import { useCalDavSettingsContext } from "../context";

export default function CalDavSyncStatusCard() {
  const t = useTranslations("settings.caldav.syncStatus");
  const {
    syncStatuses,
    syncStatusPage,
    syncStatusTotal,
    syncStatusSummary,
    setSyncStatusPage,
    syncStatusFilter,
    setSyncStatusFilter,
    triggerManualSync,
  } = useCalDavSettingsContext();

  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await triggerManualSync();
    } finally {
      setSyncing(false);
    }
  };

  const handleFilterClick = (status: "pending" | "synced" | "failed" | "removed") => {
    if (syncStatusFilter === status) {
      // Click same badge again to clear filter
      setSyncStatusFilter(undefined);
    } else {
      setSyncStatusFilter(status);
    }
    setSyncStatusPage(1); // Reset to first page
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "synced":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "danger";
      case "removed":
        return "default";
      default:
        return "default";
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "—";
    }
  };

  const pageSize = 20;
  const totalPages = Math.ceil(syncStatusTotal / pageSize);
  const startIndex = (syncStatusPage - 1) * pageSize + 1;
  const endIndex = Math.min(syncStatusPage * pageSize, syncStatusTotal);

  return (
    <Card>
      <Card.Header>
        <div className="flex w-full flex-col gap-4">
          {/* Title and Sync Button */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ClockIcon className="text-primary h-6 w-6" />
              <h2 className="text-lg font-semibold">{t("title")}</h2>
            </div>
            <Button isPending={syncing} size="sm" variant="primary" onPress={handleManualSync}>
              <ArrowPathIcon className="h-4 w-4" />
              {t("syncNow")}
            </Button>
          </div>

          {/* Summary Badges - Clickable Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                aria-pressed={syncStatusFilter === "synced"}
                className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
                type="button"
                onClick={() => handleFilterClick("synced")}
              >
                <Chip
                  color="success"
                  size="sm"
                  variant={syncStatusFilter === "synced" ? "primary" : "soft"}
                >
                  <Chip.Label>
                    {t("statuses.synced")}: {syncStatusSummary.synced}
                  </Chip.Label>
                </Chip>
              </button>
              <button
                aria-pressed={syncStatusFilter === "pending"}
                className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
                type="button"
                onClick={() => handleFilterClick("pending")}
              >
                <Chip
                  color="warning"
                  size="sm"
                  variant={syncStatusFilter === "pending" ? "primary" : "soft"}
                >
                  <Chip.Label>
                    {t("statuses.pending")}: {syncStatusSummary.pending}
                  </Chip.Label>
                </Chip>
              </button>
              <button
                aria-pressed={syncStatusFilter === "failed"}
                className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
                type="button"
                onClick={() => handleFilterClick("failed")}
              >
                <Chip
                  color="danger"
                  size="sm"
                  variant={syncStatusFilter === "failed" ? "primary" : "soft"}
                >
                  <Chip.Label>
                    {t("statuses.failed")}: {syncStatusSummary.failed}
                  </Chip.Label>
                </Chip>
              </button>
              <button
                aria-pressed={syncStatusFilter === "removed"}
                className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
                type="button"
                onClick={() => handleFilterClick("removed")}
              >
                <Chip
                  color="default"
                  size="sm"
                  variant={syncStatusFilter === "removed" ? "primary" : "soft"}
                >
                  <Chip.Label>
                    {t("statuses.removed")}: {syncStatusSummary.removed}
                  </Chip.Label>
                </Chip>
              </button>
            </div>

            {/* Filter Status and Count */}
            <div className="flex items-center justify-between">
              {syncStatusFilter ? (
                <Button
                  className="h-8"
                  size="sm"
                  variant="tertiary"
                  onPress={() => {
                    setSyncStatusFilter(undefined);
                    setSyncStatusPage(1);
                  }}
                >
                  {t("clearFilter")}
                </Button>
              ) : (
                <span className="text-default-400 text-base">{t("clickToFilter")}</span>
              )}
              {syncStatusTotal > 0 && (
                <p className="text-default-500 text-base">
                  {t("showingItems", { start: startIndex, end: endIndex, total: syncStatusTotal })}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card.Header>

      <Card.Content>
        {syncStatuses.length > 0 ? (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="CalDAV sync status">
                <Table.Header>
                  <Table.Column isRowHeader>{t("tableHeaders.item")}</Table.Column>
                  <Table.Column>{t("tableHeaders.type")}</Table.Column>
                  <Table.Column>{t("tableHeaders.date")}</Table.Column>
                  <Table.Column>{t("tableHeaders.meal")}</Table.Column>
                  <Table.Column>{t("tableHeaders.status")}</Table.Column>
                  <Table.Column>{t("tableHeaders.lastSync")}</Table.Column>
                  <Table.Column>{t("tableHeaders.error")}</Table.Column>
                </Table.Header>
                <Table.Body>
                  {syncStatuses.map((status) => (
                    <Table.Row key={status.id} id={status.id}>
                      <Table.Cell className="min-w-[150px] font-medium">
                        {status.recipeName || status.noteName || status.eventTitle || "—"}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip className="capitalize" size="sm" variant="soft">
                          <Chip.Label>{status.itemType}</Chip.Label>
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-sm">{status.date || "—"}</Table.Cell>
                      <Table.Cell className="text-sm capitalize">{status.slot || "—"}</Table.Cell>
                      <Table.Cell>
                        <Chip
                          className="capitalize"
                          color={getStatusColor(status.syncStatus)}
                          size="sm"
                          variant="soft"
                        >
                          <Chip.Label>{status.syncStatus}</Chip.Label>
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-default-500 text-xs">
                        {formatDate(status.lastSyncAt)}
                      </Table.Cell>
                      <Table.Cell>
                        {status.errorMessage ? (
                          <Popover>
                            <PopoverButtonTrigger
                              isIconOnly
                              aria-label={t("errorDetails")}
                              size="sm"
                              variant="danger-soft"
                            >
                              <InformationCircleIcon className="h-4 w-4" />
                            </PopoverButtonTrigger>
                            <Popover.Content placement="left">
                              <Popover.Dialog className="max-w-xs">
                                <Popover.Heading>{t("errorDetails")}</Popover.Heading>
                                <p className="text-danger text-xs">{status.errorMessage}</p>
                              </Popover.Dialog>
                            </Popover.Content>
                          </Popover>
                        ) : (
                          <span className="text-default-400 text-xs">—</span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        ) : (
          <p className="text-default-500 py-8 text-center text-sm">
            {syncStatusFilter
              ? t("emptyFiltered", { status: syncStatusFilter })
              : t("emptyDefault")}
          </p>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center">
            <Pagination aria-label="CalDAV sync status pages" size="sm">
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.Previous
                    aria-label="Previous page"
                    isDisabled={syncStatusPage <= 1}
                    onPress={() => setSyncStatusPage(syncStatusPage - 1)}
                  >
                    <Pagination.PreviousIcon />
                  </Pagination.Previous>
                </Pagination.Item>
                <Pagination.Item>
                  <Pagination.Summary>
                    {syncStatusPage} / {totalPages}
                  </Pagination.Summary>
                </Pagination.Item>
                <Pagination.Item>
                  <Pagination.Next
                    aria-label="Next page"
                    isDisabled={syncStatusPage >= totalPages}
                    onPress={() => setSyncStatusPage(syncStatusPage + 1)}
                  >
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
