import {CleanupService} from '../operations/application/cleanup.service.js';
import {RefundService} from '../refunds/application/refunds.service.js';
import {PaymentService} from '../payments/application/payments.service.js';
import {MaintenanceService} from '../operations/application/maintenance.service.js';
import {NotificationService} from '../notifications/application/notifications.service.js';
import {CheckoutService} from '../checkout/application/checkout.service.js';
import {CartService} from '../cart/application/cart.service.js';
import {CustomerService} from '../customer/application/customer.service.js';
import {
  Body, Controller, Get, Query, Headers, Injectable, CanActivate, ExecutionContext,
  ForbiddenException, Optional, Inject, ServiceUnavailableException, Param, ParseUUIDPipe, Patch, Post, UseGuards
} from "@nestjs/common";
import { MerchantService } from "../merchant/application/merchant.service.js";
import { IdentityService } from "../identity/application/identity.service.js";
import { COMMERCE_REPOSITORY } from "../application/commerce.port.js";
import type { CommerceRepository } from "../application/commerce.port.js";
import { CommerceService } from "../application/commerce.service.js";
import { CreateProductDto, CreateStoreDto, StockAdjustmentDto, UpdateProductDto, PublicProductQueryDto, PublicCollectionQueryDto } from "./commerce.dto.js";

@Injectable()
export class LocalDemoAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (process.env.NODE_ENV !== "development" || process.env.DEMO_AUTH_ENABLED !== "true") {
      throw new ForbiddenException("Demo authentication is disabled; configure real authentication before production use.");
    }
    const subject = context.switchToHttp().getRequest().headers["x-demo-subject-id"];
    if (typeof subject !== "string" || !/^[a-zA-Z0-9_-]{3,100}$/.test(subject)) {
      throw new ForbiddenException("Valid x-demo-subject-id header required for local demo.");
    }
    return true;
  }
}

@Controller("v1/admin")
@UseGuards(LocalDemoAuthGuard)
export class AdminCommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Post("stores")
  createStore(@Headers("x-demo-subject-id") subjectId: string, @Body() body: CreateStoreDto) {
    return this.commerce.createStore(subjectId, body);
  }

  @Get("stores")
  listStores(@Headers("x-demo-subject-id") subjectId: string) {
    return this.commerce.listStores(subjectId);
  }

  @Post("stores/:storeId/publish")
  publishStore(@Headers("x-demo-subject-id") subjectId: string, @Param("storeId", ParseUUIDPipe) storeId: string) {
    return this.commerce.publishStore(subjectId, storeId);
  }

  @Post("stores/:storeId/products")
  createProduct(@Headers("x-demo-subject-id") subjectId: string,
    @Param("storeId", ParseUUIDPipe) storeId: string, @Body() body: CreateProductDto) {
    return this.commerce.createProduct(subjectId, storeId, body);
  }

  @Get("stores/:storeId/products")
  listProducts(@Headers("x-demo-subject-id") subjectId: string, @Param("storeId", ParseUUIDPipe) storeId: string) {
    return this.commerce.listProducts(subjectId, storeId);
  }

  @Patch("stores/:storeId/products/:productId")
  updateProduct(@Headers("x-demo-subject-id") subjectId: string,
    @Param("storeId", ParseUUIDPipe) storeId: string, @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: UpdateProductDto) {
    return this.commerce.updateProduct(subjectId, storeId, productId, body);
  }

  @Post("stores/:storeId/products/:productId/activate")
  activateProduct(@Headers("x-demo-subject-id") subjectId: string,
    @Param("storeId", ParseUUIDPipe) storeId: string, @Param("productId", ParseUUIDPipe) productId: string) {
    return this.commerce.activateProduct(subjectId, storeId, productId);
  }

  @Post("stores/:storeId/variants/:variantId/stock-adjustments")
  adjustStock(@Headers("x-demo-subject-id") subjectId: string,
    @Param("storeId", ParseUUIDPipe) storeId: string, @Param("variantId", ParseUUIDPipe) variantId: string,
    @Body() body: StockAdjustmentDto) {
    return this.commerce.adjustStock(subjectId, storeId, variantId, body);
  }

  @Get("stores/:storeId/inventory-movements")
  movements(@Headers("x-demo-subject-id") subjectId: string, @Param("storeId", ParseUUIDPipe) storeId: string) {
    return this.commerce.movements(subjectId, storeId);
  }
}

@Controller("v1/storefront")
export class StorefrontCommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Get(':handle')
  store(@Param('handle') handle:string){return this.commerce.publicStore(handle);}

  @Get(':handle/checkout-options')
  checkoutOptions(@Param('handle') handle:string){return this.commerce.publicCheckoutOptions(handle);}

  @Get(":handle/products")
  products(@Param("handle") handle: string,@Query() query:PublicProductQueryDto) { return this.commerce.publicCatalog(handle,query); }

  @Get(":handle/products/:productHandle")
  detail(@Param("handle") handle:string,@Param("productHandle") product:string){return this.commerce.publicProductDetail(handle,product); }
  @Get(':handle/collections')
  collections(@Param('handle') handle:string,@Query() query:PublicCollectionQueryDto){return this.commerce.publicCollections(handle,{...query,featured:query.featured===undefined?undefined:query.featured==='true'});}
  @Get(':handle/collections/:collectionHandle')
  collection(@Param('handle') handle:string,@Param('collectionHandle') collection:string,@Query() query:PublicProductQueryDto){return this.commerce.publicCollection(handle,collection,query);}

}

@Controller("health")
export class HealthController {
  constructor(@Inject(COMMERCE_REPOSITORY) private readonly repository: CommerceRepository, @Optional() private readonly identity?: IdentityService, @Optional() private readonly merchant?: MerchantService, @Optional() private readonly customer?:CustomerService, @Optional() private readonly carts?:CartService, @Optional() private readonly checkouts?:CheckoutService, @Optional() private readonly notifications?:NotificationService, @Optional() private readonly maintenance?:MaintenanceService, @Optional() private readonly payments?:PaymentService, @Optional() private readonly refunds?:RefundService, @Optional() private readonly cleanup?:CleanupService) {}

  @Get("ready")
  async ready() {
    try { await this.repository.checkHealth(); await this.identity?.checkHealth(); await this.merchant?.checkHealth(); await this.customer?.checkHealth(); await this.carts?.checkHealth(); await this.checkouts?.checkHealth(); await this.notifications?.checkHealth(); await this.maintenance?.checkHealth(); await this.payments?.checkHealth(); await this.refunds?.checkHealth(); await this.cleanup?.checkHealth(); return { status: "ready" }; }
    catch { throw new ServiceUnavailableException("Repository is unavailable."); }
  }
  @Get()
  health() { return { status: "ok" }; }
}
