import { Queue, Worker } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { indexProduct } from "./embed-index.js";

const EMBED_QUEUE = "embed";

function getConnectionOpts(): { host: string; port: number; password?: string } | null {
  const url = process.env.REDIS_URL;
  if (!url || url.length === 0) {
    return null;
  }
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    ...(u.password ? { password: u.password } : {}),
  };
}

let embedQueue: Queue | null = null;
let embedWorker: Worker | null = null;

export function getRedisConnection(): ReturnType<typeof getConnectionOpts> | null {
  return getConnectionOpts();
}

export function getEmbedQueue(): Queue | null {
  const connection = getConnectionOpts();
  if (!connection) {
    return null;
  }
  if (!embedQueue) {
    embedQueue = new Queue(EMBED_QUEUE, { connection });
  }
  return embedQueue;
}

export async function enqueueProductEmbed(productId: string): Promise<void> {
  const q = getEmbedQueue();
  if (!q) {
    return;
  }
  await q.add(
    "index",
    { productId },
    { removeOnComplete: 100, attempts: 3, backoff: { type: "exponential", delay: 2000 } }
  );
}

export function startEmbedWorker(prisma: PrismaClient, logger: FastifyBaseLogger): Worker | null {
  const connection = getConnectionOpts();
  if (!connection || embedWorker) {
    return embedWorker;
  }
  embedWorker = new Worker(
    EMBED_QUEUE,
    async (job) => {
      const productId = job.data?.productId as string | undefined;
      if (!productId) {
        return;
      }
      await indexProduct(prisma, logger, productId);
    },
    { connection, concurrency: 2 }
  );
  return embedWorker;
}

export async function shutdownQueues(): Promise<void> {
  if (embedWorker) {
    await embedWorker.close();
    embedWorker = null;
  }
  if (embedQueue) {
    await embedQueue.close();
    embedQueue = null;
  }
}
