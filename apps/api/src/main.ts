import { buildApp } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { startOutboxWorker } from "./lib/outbox-worker.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const pollMs = Number(process.env.OUTBOX_POLL_MS ?? 3000);

const app = await buildApp();
const stopWorker = startOutboxWorker(prisma, app.log, pollMs);

app.addHook("onClose", async () => {
  stopWorker();
  await prisma.$disconnect();
});

await app.listen({ port, host });
