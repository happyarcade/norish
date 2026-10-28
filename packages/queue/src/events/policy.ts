import type { PermissionLevel } from "@norish/config/zod/server-config";

import { createLogger } from "@norish/shared-server/logger";

import type { TypedEmitter } from "./emitter";

const log = createLogger("events");

export interface PolicyEmitContext {
  userId: string;
  householdKey: string;
}

export function emitByPolicy<
  TEvents extends Record<string, unknown>,
  K extends keyof TEvents & string,
>(
  emitter: TypedEmitter<TEvents>,
  viewPolicy: PermissionLevel,
  ctx: PolicyEmitContext,
  event: K,
  data: TEvents[K]
): void {
  log.debug(
    { event, viewPolicy, householdKey: ctx.householdKey, userId: ctx.userId },
    "Emitting event via policy"
  );

  switch (viewPolicy) {
    case "everyone":
      void emitter.broadcast(event, data);
      break;
    case "household":
      void emitter.emitToHousehold(ctx.householdKey, event, data);
      break;
    case "owner":
      void emitter.emitToUser(ctx.userId, event, data);
      break;
  }
}
