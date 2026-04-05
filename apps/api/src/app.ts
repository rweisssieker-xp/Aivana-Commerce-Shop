import Fastify, { type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { healthRoutes } from "./routes/health.js";
import { productRoutes } from "./routes/products.js";
import { cartRoutes } from "./routes/carts.js";
import { searchRoutes } from "./routes/search.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { orderRoutes } from "./routes/orders.js";
import { organizationRoutes } from "./routes/organizations.js";
import tenantAuthPlugin from "./plugins/tenant-auth.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(swagger, {
    openapi: {
      info: { title: "Aivana Commerce API", version: "0.2.0" },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(healthRoutes);

  await app.register(async (scope) => {
    await scope.register(tenantAuthPlugin);
    await scope.register(productRoutes);
    await scope.register(cartRoutes);
    await scope.register(searchRoutes);
    await scope.register(webhookRoutes);
    await scope.register(orderRoutes);
    await scope.register(organizationRoutes);
  }, { prefix: "/v1" });

  return app;
}
