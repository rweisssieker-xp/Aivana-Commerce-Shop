import type { FastifyPluginAsync } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const createBody = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
});

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/webhooks/endpoints", async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const tenantId = req.tenantId;
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const created = await prisma.webhookEndpoint.create({
      data: {
        tenantId,
        url: parsed.data.url,
        secret,
        events: parsed.data.events,
      },
    });
    return reply.status(201).send({
      id: created.id,
      url: created.url,
      events: created.events,
      active: created.active,
      createdAt: created.createdAt,
      secret,
    });
  });

  app.get("/webhooks/endpoints", async (req) => {
    const tenantId = req.tenantId;
    return prisma.webhookEndpoint.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
      },
    });
  });

  app.delete<{ Params: { id: string } }>("/webhooks/endpoints/:id", async (req, reply) => {
    const tenantId = req.tenantId;
    const res = await prisma.webhookEndpoint.deleteMany({
      where: { id: req.params.id, tenantId },
    });
    if (res.count === 0) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.status(204).send();
  });
};
