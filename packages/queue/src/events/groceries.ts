import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

import { createTypedEmitter, TypedEmitter } from "./emitter";

export type GrocerySubscriptionEvents = {
  created: { groceries: GroceryDto[] };
  updated: { changedGroceries: GroceryDto[] };
  deleted: { groceryIds: string[] };
  recurringCreated: { recurringGrocery: RecurringGroceryDto; grocery: GroceryDto };
  recurringUpdated: { recurringGrocery: RecurringGroceryDto; grocery: GroceryDto };
  recurringDeleted: { recurringGroceryId: string };
  failed: { reason: string };
};

declare global {
  var __groceryEmitter__: TypedEmitter<GrocerySubscriptionEvents> | undefined;
}

export const groceryEmitter: TypedEmitter<GrocerySubscriptionEvents> =
  globalThis.__groceryEmitter__ ||
  (globalThis.__groceryEmitter__ = createTypedEmitter<GrocerySubscriptionEvents>("grocery"));
