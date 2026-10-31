import {PaymentModule} from './payments/payments.module.js';
import {PaymentsController} from './payments/http/payments.controller.js';
import {OperationsModule} from './operations/operations.module.js';
import {NotificationModule} from './notifications/notifications.module.js';
import {CustomerOrdersController} from './orders/http/customer-orders.controller.js';
import {CheckoutService} from './checkout/application/checkout.service.js';
import {CheckoutController} from './checkout/http/checkout.controller.js';
import {PrismaCheckoutRepository} from './checkout/infrastructure/prisma-checkout.repository.js';
import {CartService} from './cart/application/cart.service.js';
import {CartController} from './cart/http/cart.controller.js';
import {PrismaCartRepository} from './cart/infrastructure/prisma-cart.repository.js';
import {FirstPartyIdentityAuthority} from './identity/infrastructure/credentials.js';
import * as identitySecrets from './identity/infrastructure/secrets.js';
import {CustomerService} from './customer/application/customer.service.js';
import {PrismaCustomerRepository} from './customer/infrastructure/prisma-customer.repository.js';
import {CustomerController,CustomerGuard} from './customer/http/customer.controller.js';
import {PrismaIdentityRepository} from './identity/infrastructure/prisma-identity.repository.js';
import {StorageModule} from './media/storage.module.js';
import {MediaController} from './media/http/media.controller.js';
import {MediaService} from './media/application/media.service.js';
import {OBJECT_STORAGE,type ObjectStoragePort} from './media/application/media.port.js';
import { MerchantModule } from "./merchant/merchant.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { readRuntimeConfig } from "./config/runtime.js";
import { Module } from "@nestjs/common";
import { CommerceService } from "./application/commerce.service.js";
import { COMMERCE_REPOSITORY } from "./application/commerce.port.js";
import type { CommerceRepository } from "./application/commerce.port.js";
import { MemoryCommerceRepository } from "./infrastructure/memory-commerce.repository.js";
import { AdminCommerceController, HealthController, LocalDemoAuthGuard, StorefrontCommerceController } from "./http/commerce.controller.js";

@Module({
  imports: [PaymentModule,OperationsModule,NotificationModule,IdentityModule, MerchantModule,StorageModule],
  controllers: [PaymentsController,CustomerOrdersController,CheckoutController,CartController,CustomerController,MediaController,AdminCommerceController, StorefrontCommerceController, HealthController],
  providers: [
    {provide:PrismaCheckoutRepository,useFactory:()=>new PrismaCheckoutRepository()},
    {provide:CheckoutService,useFactory:(repository:PrismaCheckoutRepository)=>new CheckoutService(repository),inject:[PrismaCheckoutRepository]},
    {provide:PrismaCartRepository,useFactory:()=>new PrismaCartRepository()},
    {provide:CartService,useFactory:(repository:PrismaCartRepository,commerce:CommerceRepository)=>new CartService(repository,commerce,identitySecrets),inject:[PrismaCartRepository,COMMERCE_REPOSITORY]},
    CustomerGuard,
    {provide:PrismaCustomerRepository,useFactory:()=>new PrismaCustomerRepository()},
    {provide:CustomerService,useFactory:(commerce:CommerceRepository,identity:PrismaIdentityRepository,customers:PrismaCustomerRepository)=>new CustomerService(commerce,identity,customers,new FirstPartyIdentityAuthority(),identitySecrets),inject:[COMMERCE_REPOSITORY,PrismaIdentityRepository,PrismaCustomerRepository]},
    {provide:MediaService,useFactory:(repo:CommerceRepository,storage:ObjectStoragePort)=>new MediaService(repo,storage),inject:[COMMERCE_REPOSITORY,OBJECT_STORAGE]},
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
