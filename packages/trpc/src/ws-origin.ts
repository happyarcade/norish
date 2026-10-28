import { SERVER_CONFIG } from "@norish/config/env-config-server";

type WebSocketOriginConfig = {
  authUrl: string;
  trustedOrigins: string[];
};

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Browsers attach their page origin to a WebSocket upgrade. Only the public
 * app URL, explicitly trusted origins, or the request's own host may carry a
 * session cookie onto the socket. Native clients commonly omit Origin.
 */
export function isTrustedWebSocketOrigin(
  origin: string | undefined,
  requestHost: string | undefined,
  config: WebSocketOriginConfig = {
    authUrl: SERVER_CONFIG.AUTH_URL,
    trustedOrigins: SERVER_CONFIG.TRUSTED_ORIGINS,
  }
): boolean {
  if (origin === undefined) return true;

  const candidate = originOf(origin);

  if (!candidate) return false;

  const trusted = new Set<string>();
  const authOrigin = originOf(config.authUrl);

  if (authOrigin) trusted.add(authOrigin);

  for (const entry of config.trustedOrigins) {
    const trustedOrigin = originOf(entry);

    if (trustedOrigin) trusted.add(trustedOrigin);
  }

  if (requestHost) {
    for (const scheme of ["http", "https"]) {
      const hostOrigin = originOf(`${scheme}://${requestHost}`);

      if (hostOrigin) trusted.add(hostOrigin);
    }
  }

  return trusted.has(candidate);
}
