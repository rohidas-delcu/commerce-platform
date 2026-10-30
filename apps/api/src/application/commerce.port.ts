import type { InventoryMovement, Product, Store } from "../domain/commerce.js";

export const COMMERCE_REPOSITORY = Symbol("COMMERCE_REPOSITORY");

export interface CommerceRepository {
  checkHealth(): Promise<void>;
  createStore(store: Store): Promise<Store>;
  findStoreById(id: string): Promise<Store | null>;
  findStoreByHandle(handle: string): Promise<Store | null>;
  listStoresForOwner(ownerId: string): Promise<Store[]>;
  saveStore(store: Store): Promise<Store>;
  createProduct(product: Product): Promise<Product>;
  findProduct(storeId: string, productId: string): Promise<Product | null>;
  listProducts(storeId: string): Promise<Product[]>;
  saveProduct(product: Product): Promise<Product>;
  skuExists(storeId: string, sku: string, exceptProductId?: string): Promise<boolean>;
  adjustStock(input: {
    storeId: string; variantId: string; after: number; reason: string;
    note: string; actorSubjectId: string;
  }): Promise<InventoryMovement>;
  listMovements(storeId: string): Promise<InventoryMovement[]>;
}
