import superjson from "superjson";
import { createLogger } from "@norish/shared-server/logger";

import { getPublisherClient } from "../redis/client";

const log = createLogger("connection-invalidation");

export const INVALIDATION_CHANNEL = "norish:connection:invalidate";

export type InvalidationMessage = {
  userId: string;
  reason: string;
};

export async function emitConnectionInvalidation(userId: string, reason: string): Promise<void> {
  const client = await getPublisherClient();
  const message: InvalidationMessage = { userId, reason };

  await client.publish(INVALIDATION_CHANNEL, superjson.stringify(message));
  log.debug({ userId, reason }, "Emitted connection invalidation");
}
