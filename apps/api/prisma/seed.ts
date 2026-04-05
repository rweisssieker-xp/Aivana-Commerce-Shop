import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo Merchant", slug: "demo" },
  });

  const rawKey = `ak_${randomBytes(24).toString("hex")}`;
  const keyHash = hashKey(rawKey);

  await prisma.apiKey.create({
    data: {
      tenantId: tenant.id,
      keyHash,
      name: "seed",
    },
  });

  const product = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      name: "Demo Product",
      slug: "demo-product",
      description: "Seed catalog item for semantic search smoke tests.",
      variants: {
        create: {
          tenantId: tenant.id,
          sku: "DEMO-SKU-1",
          priceCents: 999,
          currency: "EUR",
        },
      },
    },
    include: { variants: true },
  });

    console.log(JSON.stringify({ tenantId: tenant.id, apiKey: rawKey, productId: product.id }, null, 2));
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

