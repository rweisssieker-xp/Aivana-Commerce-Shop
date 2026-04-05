import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getApiKeyFromRequest, resolveTenantFromApiKey } from "../lib/auth.js";

const tenantAuthPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req, reply) => {
    try {
      const key = getApiKeyFromRequest(req);
      const tenantId = await resolveTenantFromApiKey(key, async (hash) => {
        const row = await prisma.apiKey.findFirst({
          where: { keyHash: hash, revokedAt: null },
          select: { tenantId: true },
        });
        return row;
      });
      req.tenantId = tenantId;
    } catch (err) {
      const code = err instanceof Error ? err.message : "auth_error";
      if (code === "missing_api_key") {
        return reply.status(401).send({ error: "Missing X-API-Key header" });
      }
      return reply.status(401).send({ error: "Invalid API key" });
    }
  });
};

export default fp(tenantAuthPlugin);
