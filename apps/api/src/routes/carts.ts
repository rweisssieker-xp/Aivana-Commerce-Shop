import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const lineBody = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const cartRoutes: FastifyPluginAsync = async (app) => {
  app.post("/carts", async (req) => {
    const tenantId = req.tenantId;
    const cart = await prisma.cart.create({
      data: { tenantId },
    });
    return cart;
  });

  app.get<{ Params: { id: string } }>("/carts/:id", async (req, reply) => {
    const tenantId = req.tenantId;
    const cart = await prisma.cart.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        lines: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!cart) {
      return reply.status(404).send({ error: "Not found" });
    }
    return cart;
  });

  app.post<{ Params: { id: string } }>("/carts/:id/lines", async (req, reply) => {
    const parsed = lineBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const tenantId = req.tenantId;
    const cart = await prisma.cart.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!cart) {
      return reply.status(404).send({ error: "Cart not found" });
    }
    const variant = await prisma.productVariant.findFirst({
      where: { id: parsed.data.variantId, tenantId },
    });
    if (!variant) {
      return reply.status(400).send({ error: "Variant not found for tenant" });
    }
    const line = await prisma.cartLine.create({
      data: {
        cartId: cart.id,
        variantId: variant.id,
        quantity: parsed.data.quantity,
      },
      include: { variant: { include: { product: true } } },
    });
    return reply.status(201).send(line);
  });

  app.post<{ Params: { id: string } }>("/carts/:id/checkout", async (req, reply) => {
    const tenantId = req.tenantId;
    const cart = await prisma.cart.findFirst({
      where: { id: req.params.id, tenantId },
      include: { lines: { include: { variant: true } } },
    });
    if (!cart) {
      return reply.status(404).send({ error: "Cart not found" });
    }
    if (cart.lines.length === 0) {
      return reply.status(400).send({ error: "Cart is empty" });
    }

    let total = 0;
    for (const line of cart.lines) {
      total += line.quantity * line.variant.priceCents;
    }

    const currency = cart.lines[0]?.variant.currency ?? "EUR";

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenantId,
          status: "pending",
          totalCents: total,
          currency,
          lines: {
            create: cart.lines.map((l) => ({
              variantId: l.variantId,
              quantity: l.quantity,
              unitPriceCents: l.variant.priceCents,
            })),
          },
        },
        include: { lines: { include: { variant: { include: { product: true } } } } },
      });

      await tx.cartLine.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.delete({ where: { id: cart.id } });

      return created;
    });

    return reply.status(201).send(order);
  });
};

