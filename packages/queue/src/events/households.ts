import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";

import { createTypedEmitter, TypedEmitter } from "./emitter";

export type HouseholdUserInfo = {
  id: string;
  name: string | null;
  isAdmin: boolean;
};

export type HouseholdSubscriptionEvents = {
  created: {
    household: HouseholdSettingsDto | HouseholdAdminSettingsDto;
  };
  userJoined: {
    user: HouseholdUserInfo;
  };
  userLeft: {
    userId: string;
  };
  userKicked: {
    householdId: string;
    kickedBy: string;
  };
  memberRemoved: {
    userId: string;
  };
  adminTransferred: {
    oldAdminId: string;
    newAdminId: string;
  };
  joinCodeRegenerated: {
    joinCode: string;
    joinCodeExpiresAt: string;
  };
  allergiesUpdated: {
    allergies: string[];
  };
  failed: {
    reason: string;
  };
};

declare global {
  var __householdEmitter__: TypedEmitter<HouseholdSubscriptionEvents> | undefined;
}

export const householdEmitter: TypedEmitter<HouseholdSubscriptionEvents> =
  globalThis.__householdEmitter__ ||
  (globalThis.__householdEmitter__ = createTypedEmitter<HouseholdSubscriptionEvents>("household"));
