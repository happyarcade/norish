import type { UserCaldavConfigWithoutPasswordDto } from "@norish/shared/contracts";

import { createTypedEmitter, TypedEmitter } from "./emitter";

export type CaldavItemType = "recipe" | "note";
export type CaldavSyncStatus = "pending" | "synced" | "failed" | "removed";

export type CaldavSubscriptionEvents = {
  configSaved: { config: UserCaldavConfigWithoutPasswordDto | null };
  syncStarted: { timestamp: string };
  syncCompleted: { itemId: string; caldavEventUid: string };
  syncFailed: { itemId: string; errorMessage: string; retryCount: number };
  itemStatusUpdated: {
    itemId: string;
    itemType: CaldavItemType;
    syncStatus: CaldavSyncStatus;
    errorMessage: string | null;
    caldavEventUid: string | null;
  };
  initialSyncComplete: { timestamp: string; totalSynced: number; totalFailed: number };
};

declare global {
  var __caldavEmitter__: TypedEmitter<CaldavSubscriptionEvents> | undefined;
}

export const caldavEmitter: TypedEmitter<CaldavSubscriptionEvents> =
  globalThis.__caldavEmitter__ ||
  (globalThis.__caldavEmitter__ = createTypedEmitter<CaldavSubscriptionEvents>("caldav"));
