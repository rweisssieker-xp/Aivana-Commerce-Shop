import type { FastifyBaseLogger } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { embedOpenAIText } from "./embeddings.js";

export async function indexProduct(
  prisma: PrismaClient,
  logger: FastifyBaseLogger,
  productId: string
): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
  if (!product) {
    logger.warn({ productId }, "embed: product not found");
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    logger.debug({ productId }, "embed: skipped (no OPENAI_API_KEY)");
    return;
  }
  const text = [product.name, product.description ?? ""].join("\n").trim();
  if (text.length === 0) {
    return;
  }
  try {
    const values = await embedOpenAIText(text);
    const jsonValues = values as unknown as Prisma.InputJsonValue;
    await prisma.productEmbedding.upsert({
      where: { productId },
      create: {
        tenantId: product.tenantId,
        productId,
        dims: values.length,
        values: jsonValues,
      },
      update: {
        dims: values.length,
        values: jsonValues,
      },
    });
    logger.info({ productId }, "embed: indexed");
  } catch (e) {
    logger.error({ productId, err: e }, "embed: failed");
  }
}
