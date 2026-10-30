import { randomUUID } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { COMMERCE_REPOSITORY, COMMERCE_AUTHORIZATION } from "./commerce.port.js";
import type { CommerceRepository, CommerceAuthorizationPort } from "./commerce.port.js";
import { DomainError, normalizeHandle, normalizeMoneyMinor, validateProductInput } from "../domain/commerce.js";
import type { Product, Store } from "../domain/commerce.js";

@Injectable()
export class CommerceService {
  constructor(@Inject(COMMERCE_REPOSITORY) private readonly repository: CommerceRepository, @Optional() @Inject(COMMERCE_AUTHORIZATION) private readonly authorization?: CommerceAuthorizationPort) {}

  private async ownedStore(storeId: string, subjectId: string): Promise<Store> {
    const store = await this.repository.findStoreById(storeId);
    if (!store) throw new DomainError("NOT_FOUND", "Store not found.");
    if (this.authorization) await this.authorization.assertStoreAccess(store, subjectId);
    else if (store.merchantManaged || store.ownerSubjectId !== subjectId) throw new DomainError("NOT_FOUND", "Store not found.");
    return store;
  }

  async createStore(subjectId: string, input: { name: string; handle: string; countryCode?: string; currencyCode?: string }) {
    const name = String(input.name || "").trim();
    if (!name || name.length > 100) throw new DomainError("INVALID", "Store name is required (up to 100 characters).");
    const countryCode = (input.countryCode || "IN").toUpperCase();
    const currencyCode = (input.currencyCode || "INR").toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode) || !/^[A-Z]{3}$/.test(currencyCode))
      throw new DomainError("INVALID", "Use ISO country and currency codes.");
    return this.repository.createStore({
      id: randomUUID(), ownerSubjectId: subjectId, name, handle: normalizeHandle(input.handle),
      countryCode, currencyCode, status: "DRAFT", createdAt: new Date().toISOString()
    });
  }

  listStores(subjectId: string) { return this.repository.listStoresForOwner(subjectId); }

  async publishStore(subjectId: string, storeId: string) {
    const store = await this.ownedStore(storeId, subjectId);
    store.status = "PUBLISHED";
    return this.repository.saveStore(store);
  }

  async createProduct(subjectId: string, storeId: string, input: {
    name: string; handle: string; description?: string; collection?: string;
    priceMinor: string; compareMinor?: string | null;
    variants: Array<{ name: string; sku: string; stock: number }>;
  }) {
    await this.ownedStore(storeId, subjectId);
    const validated = validateProductInput(input);
    const product: Product = {
      id: randomUUID(), storeId, version: 0, ...validated,
      description: (input.description || "").trim(), collection: (input.collection || "").trim(),
      status: "DRAFT", createdAt: new Date().toISOString(),
      variants: validated.variants.map(v => ({ ...v, id: randomUUID() }))
    };
    return this.repository.createProduct(product);
  }

  async listProducts(subjectId: string, storeId: string) {
    await this.ownedStore(storeId, subjectId);
    return this.repository.listProducts(storeId);
  }

  async updateProduct(subjectId: string, storeId: string, productId: string, input: {
    name?: string; handle?: string; description?: string; collection?: string;
    priceMinor?: string; compareMinor?: string | null;
  }) {
    await this.ownedStore(storeId, subjectId);
    const product = await this.repository.findProduct(storeId, productId);
    if (!product) throw new DomainError("NOT_FOUND", "Product not found.");
    const name = input.name === undefined ? product.name : input.name.trim();
    if (!name || name.length > 150) throw new DomainError("INVALID", "Valid product name required.");
    product.name = name;
    if (input.handle !== undefined) product.handle = normalizeHandle(input.handle);
    if (input.description !== undefined) product.description = input.description.trim();
    if (input.collection !== undefined) product.collection = input.collection.trim();
    if (input.priceMinor !== undefined) product.priceMinor = normalizeMoneyMinor(input.priceMinor);
    if (input.compareMinor !== undefined) product.compareMinor = input.compareMinor ? normalizeMoneyMinor(input.compareMinor) : null;
    if (product.compareMinor && BigInt(product.compareMinor) <= BigInt(product.priceMinor))
      throw new DomainError("INVALID", "Compare price must exceed selling price.");
    return this.repository.saveProduct(product);
  }

  async activateProduct(subjectId: string, storeId: string, productId: string) {
    await this.ownedStore(storeId, subjectId);
    const product = await this.repository.findProduct(storeId, productId);
    if (!product) throw new DomainError("NOT_FOUND", "Product not found.");
    if (!product.variants.length) throw new DomainError("INVALID", "At least one variant is required.");
    product.status = "ACTIVE";
    return this.repository.saveProduct(product);
  }

  async adjustStock(subjectId: string, storeId: string, variantId: string, input: { quantity: number; reason: string; note?: string }) {
    await this.ownedStore(storeId, subjectId);
    return this.repository.adjustStock({
      storeId, variantId, after: input.quantity, reason: input.reason,
      note: (input.note || "").trim().slice(0, 500), actorSubjectId: subjectId
    });
  }

  async movements(subjectId: string, storeId: string) {
    await this.ownedStore(storeId, subjectId);
    return this.repository.listMovements(storeId);
  }

  async publicCatalog(storeHandle: string) {
    const store = await this.repository.findStoreByHandle(normalizeHandle(storeHandle));
    if (!store || store.status !== "PUBLISHED" || store.suspended || store.archivedAt || (store.merchantStatus && !["ACTIVE","QUARANTINED"].includes(store.merchantStatus))) throw new DomainError("NOT_FOUND", "Store not found.");
    const products = await this.repository.listProducts(store.id);
    return {
      store: { handle: store.handle, name: store.name, currencyCode: store.currencyCode, countryCode: store.countryCode },
      products: products.filter(p => p.status === "ACTIVE").map(p => ({
        id: p.id, name: p.name, handle: p.handle, description: p.description,
        collection: p.collection, priceMinor: p.priceMinor, compareMinor: p.compareMinor,
        variants: p.variants.map(v => ({ id: v.id, name: v.name, stock: v.stock, available: v.stock > 0 }))
      }))
    };
  }
}
