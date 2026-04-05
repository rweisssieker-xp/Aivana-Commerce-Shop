import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const patchBody = z.object({
  status: z.enum(["pending", "confirmed", "cancelled"]),
});

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.get("/orders", async (req) => {
    const tenantId = req.tenantId;
    const limit = Math.min(100, Math.max(1, Number((req.query as { limit?: string }).limit ?? 50)));
    return prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        lines: { include: { variant: { include: { product: true } } } },
      },
    });
  });

  app.get<{ Params: { id: string } }>("/orders/:id", async (req, reply) => {
    const tenantId = req.tenantId;
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        organization: true,
        lines: { include: { variant: { include: { product: true } } } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) {
      return reply.status(404).send({ error: "Not found" });
    }
    return order;
  });

  app.patch<{ Params: { id: string } }>("/orders/:id", async (req, reply) => {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const tenantId = req.tenantId;
    const nextStatus = parsed.data.status;

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!existing) {
        return null;
      }
      if (existing.status === nextStatus) {
        return tx.order.findFirst({
          where: { id: existing.id },
          include: {
            organization: true,
            lines: { include: { variant: { include: { product: true } } } },
            events: { orderBy: { createdAt: "asc" } },
          },
        });
      }
      const order = await tx.order.update({
        where: { id: existing.id },
        data: { status: nextStatus },
        include: {
          organization: true,
          lines: { include: { variant: { include: { product: true } } } },
          events: { orderBy: { createdAt: "asc" } },
        },
      });
      await tx.orderEvent.create({
        data: {
          tenantId,
          orderId: order.id,
          kind: "order.status_changed",
          payload: { from: existing.status, to: nextStatus },
        },
      });
      return order;
    });

    if (!updated) {
      return reply.status(404).send({ error: "Not found" });
    }
    return updated;
  });
};
