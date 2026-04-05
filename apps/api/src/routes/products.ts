import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { enqueueProductEmbed } from "../lib/queues.js";

const createBody = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1),
        priceCents: z.number().int().nonnegative(),
        currency: z.string().min(3).max(3).optional(),
      })
    )
    .min(1),
});

const patchBody = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.post("/products", async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const tenantId = req.tenantId;
    const body = parsed.data;
    const product = await prisma.product.create({
      data: {
        tenantId,
        name: body.name,
        slug: body.slug,
        description: body.description,
        variants: {
          create: body.variants.map((v) => ({
            tenantId,
            sku: v.sku,
            priceCents: v.priceCents,
            currency: v.currency ?? "EUR",
          })),
        },
      },
      include: { variants: true },
    });
    void enqueueProductEmbed(product.id);
    return reply.status(201).send(product);
  });

  app.get("/products", async (req) => {
    const tenantId = req.tenantId;
    return prisma.product.findMany({
      where: { tenantId },
      include: { variants: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.get<{ Params: { id: string } }>("/products/:id", async (req, reply) => {
    const tenantId = req.tenantId;
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId },
      include: { variants: true },
    });
    if (!product) {
      return reply.status(404).send({ error: "Not found" });
    }
    return product;
  });

  app.patch<{ Params: { id: string } }>("/products/:id", async (req, reply) => {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const tenantId = req.tenantId;
    const data = parsed.data;
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Not found" });
    }
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
      include: { variants: true },
    });
    void enqueueProductEmbed(product.id);
    return product;
  });
};
