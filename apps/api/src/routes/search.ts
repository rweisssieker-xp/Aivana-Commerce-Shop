import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { searchProducts } from "../lib/search.js";

const querySchema = z.object({
  q: z.string().min(1),
});

export const searchRoutes: FastifyPluginAsync = async (app) => {
  app.get("/search", async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Query parameter q is required" });
    }
    const tenantId = req.tenantId;
    const body = await searchProducts(tenantId, parsed.data.q);
    return body;
  });
};

