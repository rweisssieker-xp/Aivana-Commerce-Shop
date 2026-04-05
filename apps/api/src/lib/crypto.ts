import { createHash, randomBytes } from "node:crypto";

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey(): string {
  return `ak_${randomBytes(24).toString("hex")}`;
}
