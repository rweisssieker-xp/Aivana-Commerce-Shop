import type { Prisma } from "@prisma/client";

type OrderWithLines = Prisma.OrderGetPayload<{
  include: {
    lines: { include: { variant: { include: { product: true } } } };
  };
}>;

export async function enqueueOrderCreatedEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  order: OrderWithLines
): Promise<void> {
  const payload: Prisma.InputJsonValue = {
    orderId: order.id,
    status: order.status,
    totalCents: order.totalCents,
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    lines: order.lines.map((l) => ({
      variantId: l.variantId,
      sku: l.variant.sku,
      productName: l.variant.product.name,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
    })),
  };

  await tx.orderEvent.create({
    data: {
      tenantId,
      orderId: order.id,
      kind: "order.created",
      payload: {
        totalCents: order.totalCents,
        currency: order.currency,
        lineCount: order.lines.length,
      },
    },
  });

  const event = await tx.outboxEvent.create({
    data: {
      tenantId,
      eventType: "order.created",
      payload,
    },
  });

  const endpoints = await tx.webhookEndpoint.findMany({
    where: {
      tenantId,
      active: true,
      events: { has: "order.created" },
    },
  });

  for (const endpoint of endpoints) {
    await tx.outboxDelivery.create({
      data: {
        eventId: event.id,
        endpointId: endpoint.id,
      },
    });
  }
}
