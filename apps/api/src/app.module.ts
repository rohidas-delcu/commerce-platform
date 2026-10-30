import { readRuntimeConfig } from "./config/runtime.js";
import { Module } from "@nestjs/common";
import { CommerceService } from "./application/commerce.service.js";
import { COMMERCE_REPOSITORY } from "./application/commerce.port.js";
import type { CommerceRepository } from "./application/commerce.port.js";
import { MemoryCommerceRepository } from "./infrastructure/memory-commerce.repository.js";
import { AdminCommerceController, HealthController, LocalDemoAuthGuard, StorefrontCommerceController } from "./http/commerce.controller.js";

@Module({
  controllers: [AdminCommerceController, StorefrontCommerceController, HealthController],
  providers: [
    CommerceService,
    LocalDemoAuthGuard,
    {
      provide: COMMERCE_REPOSITORY,
      useFactory: async (): Promise<CommerceRepository> => {
        const { driver } = readRuntimeConfig();
        if (driver === "memory") return new MemoryCommerceRepository();
        if (driver === "postgres") {
          // Delay importing the Prisma-generated client so demo mode can run without code generation.
          const { PrismaCommerceRepository } = await import("./infrastructure/prisma-commerce.repository.js");
          return new PrismaCommerceRepository();
        }
        throw new Error(`Unknown DATA_DRIVER: ${driver}`);
      }
    }
  ]
})
export class AppModule {}
