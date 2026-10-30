import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { checkedStockChange, DomainError } from "../domain/commerce.js";
import type { Store, Product, InventoryMovement } from "../domain/commerce.js";
import type { CommerceRepository } from "../application/commerce.port.js";

function storeDomain(row: {
  id: string; ownerSubjectId: string; name: string; handle: string;
  countryCode: string; currencyCode: string; status: string; createdAt: Date;
}): Store {
  return {
    id: row.id, ownerSubjectId: row.ownerSubjectId, name: row.name, handle: row.handle,
    countryCode: row.countryCode, currencyCode: row.currencyCode,
    status: row.status as Store["status"], createdAt: row.createdAt.toISOString()
  };
}

function productDomain(row: {
  id: string; storeId: string; version: number; name: string; handle: string; description: string;
  collection: string; priceMinor: bigint; compareMinor: bigint | null;
  status: string; createdAt: Date;
  variants: Array<{ id: string; name: string; sku: string; stock: number }>;
}): Product {
  return {
    id: row.id, storeId: row.storeId, version: row.version, name: row.name, handle: row.handle,
    description: row.description, collection: row.collection,
    priceMinor: row.priceMinor.toString(), compareMinor: row.compareMinor?.toString() ?? null,
    status: row.status as Product["status"], createdAt: row.createdAt.toISOString(),
    variants: row.variants.map(v => ({ id: v.id, name: v.name, sku: v.sku, stock: v.stock }))
  };
}

function movementDomain(row: {
  id: string; storeId: string; variantId: string; before: number; after: number;
  delta: number; reason: string; note: string; actorSubjectId: string; createdAt: Date;
}): InventoryMovement {
  return { ...row, reason: row.reason as InventoryMovement["reason"], createdAt: row.createdAt.toISOString() };
}

@Injectable()
export class PrismaCommerceRepository implements CommerceRepository, OnModuleDestroy, OnModuleInit {
  private readonly db: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required for DATA_DRIVER=postgres.");
    this.db = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000, max: 10 }, { schema: new URL(connectionString).searchParams.get("schema") ?? "public" }) });
  }

  async onModuleInit() { await this.db.$connect(); await this.checkHealth(); }

  async checkHealth() {
    // Adapter-generated queries honor the configured PostgreSQL schema.
    await Promise.all([
      this.db.store.findFirst({ select: { id: true } }),
      this.db.product.findFirst({ select: { version: true } }),
      this.db.productVariant.findFirst({ select: { stock: true } }),
      this.db.inventoryMovement.findFirst({ select: { delta: true } })
    ]);
  }

  async onModuleDestroy() { await this.db.$disconnect(); }

  async createStore(store: Store): Promise<Store> {
    try {
      const row = await this.db.store.create({ data: {
        id: store.id, ownerSubjectId: store.ownerSubjectId, name: store.name, handle: store.handle,
        countryCode: store.countryCode, currencyCode: store.currencyCode, status: store.status
      } });
      return storeDomain(row);
    } catch (error) { throw this.translateConflict(error); }
  }

  async findStoreById(id: string) {
    const row = await this.db.store.findUnique({ where: { id } });
    return row ? storeDomain(row) : null;
  }

  async findStoreByHandle(handle: string) {
    const row = await this.db.store.findUnique({ where: { handle } });
    return row ? storeDomain(row) : null;
  }

  async listStoresForOwner(ownerId: string) {
    return (await this.db.store.findMany({ where: { ownerSubjectId: ownerId }, orderBy: { createdAt: "desc" } })).map(storeDomain);
  }

  async saveStore(store: Store) {
    const row = await this.db.store.update({ where: { id: store.id }, data: {
      name: store.name, status: store.status
    } });
    return storeDomain(row);
  }

  async createProduct(product: Product) {
    try {
      const row = await this.db.product.create({
        data: {
          id: product.id, store: { connect: { id: product.storeId } }, name: product.name,
          handle: product.handle, description: product.description, collection: product.collection,
          priceMinor: BigInt(product.priceMinor), compareMinor: product.compareMinor === null ? null : BigInt(product.compareMinor),
          status: product.status, variants: { create: product.variants.map(v => ({
            id: v.id, name: v.name, sku: v.sku, stock: v.stock
          })) }
        }, include: { variants: true }
      });
      return productDomain(row);
    } catch (error) { throw this.translateConflict(error); }
  }

  async findProduct(storeId: string, productId: string) {
    const row = await this.db.product.findFirst({ where: { id: productId, storeId }, include: { variants: true } });
    return row ? productDomain(row) : null;
  }

  async listProducts(storeId: string) {
    return (await this.db.product.findMany({
      where: { storeId }, include: { variants: true }, orderBy: { createdAt: "desc" }
    })).map(productDomain);
  }

  async saveProduct(product: Product) {
    try {
      const row = await this.db.product.update({
        where: { id: product.id, storeId: product.storeId, version: product.version },
        data: {
          version: { increment: 1 }, name: product.name, handle: product.handle, description: product.description,
          collection: product.collection, priceMinor: BigInt(product.priceMinor),
          compareMinor: product.compareMinor === null ? null : BigInt(product.compareMinor), status: product.status
        }, include: { variants: true }
      });
      return productDomain(row);
    } catch (error) { throw this.translateConflict(error); }
  }

  async skuExists(storeId: string, sku: string, exceptProductId?: string) {
    return !!(await this.db.productVariant.findFirst({ where: {
      storeId, sku, ...(exceptProductId ? { productId: { not: exceptProductId } } : {})
    }, select: { id: true } }));
  }

  async adjustStock(input: { storeId: string; variantId: string; after: number; reason: string; note: string; actorSubjectId: string }) {
    try {
      return await this.db.$transaction(async tx => {
        const variant = await tx.productVariant.findFirst({ where: { id: input.variantId, storeId: input.storeId } });
        if (!variant) throw new DomainError("NOT_FOUND", "Variant not found.");
        const delta = checkedStockChange(variant.stock, input.after, input.reason);
        const update = await tx.productVariant.updateMany({
          where: { id: variant.id, storeId: input.storeId, stock: variant.stock }, data: { stock: input.after }
        });
        if (update.count !== 1) throw new DomainError("CONFLICT", "Stock changed. Refresh and retry the adjustment.");
        const movement = await tx.inventoryMovement.create({ data: {
          storeId: input.storeId, variantId: variant.id, before: variant.stock, after: input.after,
          delta, reason: input.reason, note: input.note, actorSubjectId: input.actorSubjectId
        } });
        return movementDomain(movement);
      });
    } catch (error) { throw this.translateConflict(error); }
  }

  async listMovements(storeId: string) {
    return (await this.db.inventoryMovement.findMany({
      where: { storeId }, orderBy: { createdAt: "desc" }, take: 200
    })).map(movementDomain);
  }

  private translateConflict(error: unknown): Error {
    if (error && typeof error === "object" && "code" in error && ["P2025", "P2034"].includes(String(error.code))) {
      return new DomainError("CONFLICT", "Record changed. Refresh and retry the update.");
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return new DomainError("CONFLICT", "A store handle, product handle or SKU already exists.");
    }
    return error instanceof Error ? error : new Error("Unknown persistence error.");
  }
}
