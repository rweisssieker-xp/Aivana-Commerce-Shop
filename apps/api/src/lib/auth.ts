import type { FastifyRequest } from "fastify";
import { hashApiKey } from "./crypto.js";

declare module "fastify" {
  interface FastifyRequest {
    tenantId: string;
  }
}

export async function resolveTenantFromApiKey(
  rawKey: string | undefined,
  lookup: (hash: string) => Promise<{ tenantId: string } | null>
): Promise<string> {
  if (!rawKey || rawKey.length < 8) {
    throw new Error("missing_api_key");
  }
  const hash = hashApiKey(rawKey);
  const row = await lookup(hash);
  if (!row) {
    throw new Error("invalid_api_key");
  }
  return row.tenantId;
}

export function getApiKeyFromRequest(req: FastifyRequest): string | undefined {
  const h = req.headers["x-api-key"];
  if (typeof h === "string") {
    return h;
  }
  if (Array.isArray(h)) {
    return h[0];
  }
  return undefined;
}
