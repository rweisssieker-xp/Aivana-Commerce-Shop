import Fastify, { type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { healthRoutes } from "./routes/health.js";
import { productRoutes } from "./routes/products.js";
import { cartRoutes } from "./routes/carts.js";
import { searchRoutes } from "./routes/search.js";
import tenantAuthPlugin from "./plugins/tenant-auth.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(swagger, {
    openapi: {
      info: { title: "Aivana Commerce API", version: "0.0.1" },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(healthRoutes);

  await app.register(async (scope) => {
    await scope.register(tenantAuthPlugin);
    await scope.register(productRoutes);
    await scope.register(cartRoutes);
    await scope.register(searchRoutes);
  }, { prefix: "/v1" });

  return app;
}
