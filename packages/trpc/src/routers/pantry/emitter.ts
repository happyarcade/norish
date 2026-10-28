import type { PantrySubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

declare global {
  var __pantryEmitter__: TypedEmitter<PantrySubscriptionEvents> | undefined;
}

export const pantryEmitter: TypedEmitter<PantrySubscriptionEvents> =
  globalThis.__pantryEmitter__ ||
  (globalThis.__pantryEmitter__ = createTypedEmitter<PantrySubscriptionEvents>("pantry"));
