import { createHmac } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";

const MAX_ATTEMPTS = 8;

function signBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function processOutboxBatch(
  prisma: PrismaClient,
  logger: FastifyBaseLogger
): Promise<void> {
  const deliveries = await prisma.outboxDelivery.findMany({
    where: {
      status: "pending",
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: 25,
    orderBy: { id: "asc" },
    include: {
      event: true,
      endpoint: true,
    },
  });

  for (const d of deliveries) {
    if (!d.endpoint.active) {
      await prisma.outboxDelivery.update({
        where: { id: d.id },
        data: { status: "failed", lastError: "endpoint_disabled" },
      });
      continue;
    }

    const body = JSON.stringify({
      id: d.event.id,
      type: d.event.eventType,
      createdAt: d.event.createdAt.toISOString(),
      data: d.event.payload,
    });

    const signature = signBody(d.endpoint.secret, body);

    try {
      const res = await fetch(d.endpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-aivana-event-id": d.event.id,
          "x-aivana-event-type": d.event.eventType,
          "x-aivana-delivery-id": d.id,
          "x-aivana-signature": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      await prisma.outboxDelivery.update({
        where: { id: d.id },
        data: { status: "sent", sentAt: new Date(), lastError: null },
      });
      logger.info({ deliveryId: d.id, eventId: d.event.id }, "webhook delivered");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextAttempts = d.attempts + 1;
      await prisma.outboxDelivery.update({
        where: { id: d.id },
        data: {
          attempts: nextAttempts,
          lastError: message.slice(0, 2000),
          status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
        },
      });
      logger.warn({ deliveryId: d.id, err: message }, "webhook delivery failed");
    }
  }
}

export function startOutboxWorker(
  prisma: PrismaClient,
  logger: FastifyBaseLogger,
  intervalMs: number
): () => void {
  const timer = setInterval(() => {
    void processOutboxBatch(prisma, logger).catch((e: unknown) => {
      logger.error(e);
    });
  }, intervalMs);

  void processOutboxBatch(prisma, logger).catch((e: unknown) => {
    logger.error(e);
  });

  return () => {
    clearInterval(timer);
  };
}
