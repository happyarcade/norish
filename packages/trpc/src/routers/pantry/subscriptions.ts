import { trpcLogger as log } from "@norish/shared-server/logger";

import type { PantrySubscriptionEvents } from "./types";
import { createSubscriptionIterable } from "../../helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { pantryEmitter } from "./emitter";

const onAdded = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = pantryEmitter.householdEvent(ctx.householdKey, "added");

  log.trace({ userId: ctx.user.id, householdKey: ctx.householdKey }, "Subscribed to pantry adds");

  for await (const data of createSubscriptionIterable(
    pantryEmitter,
    ctx.multiplexer,
    eventName,
    signal
  )) {
    yield data as PantrySubscriptionEvents["added"];
  }
});

const onRemoved = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = pantryEmitter.householdEvent(ctx.householdKey, "removed");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to pantry removals"
  );

  for await (const data of createSubscriptionIterable(
    pantryEmitter,
    ctx.multiplexer,
    eventName,
    signal
  )) {
    yield data as PantrySubscriptionEvents["removed"];
  }
});

const onUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  const eventName = pantryEmitter.householdEvent(ctx.householdKey, "updated");

  log.trace(
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "Subscribed to pantry updates"
  );

  for await (const data of createSubscriptionIterable(
    pantryEmitter,
    ctx.multiplexer,
    eventName,
    signal
  )) {
    yield data as PantrySubscriptionEvents["updated"];
  }
});

export const pantrySubscriptions = router({ onAdded, onUpdated, onRemoved });
