import {
  Body, Controller, Get, Headers, Injectable, CanActivate, ExecutionContext,
  ForbiddenException, Param, ParseUUIDPipe, Patch, Post, UseGuards
} from "@nestjs/common";
import { CommerceService } from "../application/commerce.service.js";
import { CreateProductDto, CreateStoreDto, StockAdjustmentDto, UpdateProductDto } from "./commerce.dto.js";

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

  @Get(":handle/products")
  products(@Param("handle") handle: string) { return this.commerce.publicCatalog(handle); }
}

@Controller("health")
export class HealthController {
  @Get()
  health() { return { status: "ok" }; }
}
