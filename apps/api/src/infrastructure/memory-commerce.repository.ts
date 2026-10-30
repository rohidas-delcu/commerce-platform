import { randomUUID } from "node:crypto";
import { checkedStockChange, DomainError } from "../domain/commerce.js";
import type { InventoryMovement, Product, Store } from "../domain/commerce.js";
import type { CommerceRepository } from "../application/commerce.port.js";

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryCommerceRepository implements CommerceRepository {
  private readonly stores = new Map<string, Store>();
  private readonly products = new Map<string, Product>();
  private readonly movements: InventoryMovement[] = [];

  constructor(seed = true) {
    if (!seed) return;
    const store: Store = {
      id: randomUUID(), ownerSubjectId: "demo-merchant", name: "Northline Goods",
      handle: "northline-goods", countryCode: "IN", currencyCode: "INR",
      status: "PUBLISHED", createdAt: new Date().toISOString()
    };
    const product: Product = {
      id: randomUUID(), storeId: store.id, name: "Everyday Essentials Watch",
      handle: "everyday-essentials-watch", description: "Everyday comfort and timeless style.",
      collection: "Accessories", priceMinor: "249900", compareMinor: "319900",
      status: "ACTIVE", createdAt: new Date().toISOString(),
      variants: [{ id: randomUUID(), name: "Classic", sku: "NLG-WAT-101", stock: 24 }]
    };
    this.stores.set(store.id, store);
    this.products.set(product.id, product);
  }

  async createStore(store: Store) {
    if ([...this.stores.values()].some(x => x.handle === store.handle))
      throw new DomainError("CONFLICT", "Store handle already exists.");
    this.stores.set(store.id, clone(store));
    return clone(store);
  }
  async findStoreById(id: string) { return clone(this.stores.get(id) ?? null); }
  async findStoreByHandle(handle: string) { return clone([...this.stores.values()].find(x => x.handle === handle) ?? null); }
  async listStoresForOwner(ownerId: string) { return clone([...this.stores.values()].filter(s => s.ownerSubjectId === ownerId)); }
  async saveStore(store: Store) {
    if (!this.stores.has(store.id)) throw new DomainError("NOT_FOUND", "Store not found.");
    this.stores.set(store.id, clone(store)); return clone(store);
  }
  async createProduct(product: Product) {
    if ([...this.products.values()].some(p => p.storeId === product.storeId && p.handle === product.handle))
      throw new DomainError("CONFLICT", "Product handle already exists in this store.");
    for (const variant of product.variants) {
      if (await this.skuExists(product.storeId, variant.sku))
        throw new DomainError("CONFLICT", "SKU already exists in this store.");
    }
    this.products.set(product.id, clone(product)); return clone(product);
  }
  async findProduct(storeId: string, productId: string) {
    const p = this.products.get(productId);
    return p?.storeId === storeId ? clone(p) : null;
  }
  async listProducts(storeId: string) { return clone([...this.products.values()].filter(p => p.storeId === storeId)); }
  async saveProduct(product: Product) {
    const current = this.products.get(product.id);
    if (!current || current.storeId !== product.storeId) throw new DomainError("NOT_FOUND", "Product not found.");
    if ([...this.products.values()].some(p => p.storeId === product.storeId && p.handle === product.handle && p.id !== product.id))
      throw new DomainError("CONFLICT", "Product handle already exists in this store.");
    this.products.set(product.id, clone(product)); return clone(product);
  }
  async skuExists(storeId: string, sku: string, exceptProductId?: string) {
    return [...this.products.values()].some(p => p.storeId === storeId && p.id !== exceptProductId && p.variants.some(v => v.sku === sku));
  }
  async adjustStock(input: { storeId: string; variantId: string; after: number; reason: string; note: string; actorSubjectId: string }) {
    const product = [...this.products.values()].find(p => p.storeId === input.storeId && p.variants.some(v => v.id === input.variantId));
    const variant = product?.variants.find(v => v.id === input.variantId);
    if (!variant) throw new DomainError("NOT_FOUND", "Variant not found.");
    const before = variant.stock, delta = checkedStockChange(before, input.after, input.reason);
    variant.stock = input.after;
    const movement: InventoryMovement = {
      id: randomUUID(), storeId: input.storeId, variantId: variant.id, before, after: input.after,
      delta, reason: input.reason as InventoryMovement["reason"], note: input.note,
      actorSubjectId: input.actorSubjectId, createdAt: new Date().toISOString()
    };
    this.movements.unshift(movement);
    return clone(movement);
  }
  async listMovements(storeId: string) { return clone(this.movements.filter(m => m.storeId === storeId)); }
}
