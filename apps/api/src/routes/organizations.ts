import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const createOrg = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
});

const memberBody = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "buyer"]).optional(),
});

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/organizations", async (req, reply) => {
    const parsed = createOrg.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const tenantId = req.tenantId;
    try {
      const org = await prisma.organization.create({
        data: {
          tenantId,
          name: parsed.data.name,
          slug: parsed.data.slug,
        },
      });
      return reply.status(201).send(org);
    } catch {
      return reply.status(409).send({ error: "Slug already exists for tenant" });
    }
  });

  app.get("/organizations", async (req) => {
    const tenantId = req.tenantId;
    return prisma.organization.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { members: true },
    });
  });

  app.post<{ Params: { id: string } }>("/organizations/:id/members", async (req, reply) => {
    const parsed = memberBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const tenantId = req.tenantId;
    const org = await prisma.organization.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!org) {
      return reply.status(404).send({ error: "Not found" });
    }
    try {
      const member = await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          email: parsed.data.email,
          role: parsed.data.role ?? "buyer",
        },
      });
      return reply.status(201).send(member);
    } catch {
      return reply.status(409).send({ error: "Member already exists" });
    }
  });
};
