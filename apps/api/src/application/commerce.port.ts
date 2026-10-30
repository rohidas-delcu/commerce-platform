import type {PricingRepositoryPort} from '../pricing/application/pricing.port.js';
import type {InventoryRepositoryPort} from '../inventory/application/inventory.port.js';
import type {MediaRepositoryPort} from '../media/application/media.port.js';
import type { InventoryMovement, Product, Store, ProductQuery, Variant, Collection, CollectionQuery } from "../domain/commerce.js";

export const COMMERCE_REPOSITORY = Symbol("COMMERCE_REPOSITORY");

export interface CommerceRepository {
  readonly pricing:PricingRepositoryPort;
  readonly media:MediaRepositoryPort;
  readonly inventory:InventoryRepositoryPort;
  checkHealth(): Promise<void>;
  createStore(store: Store): Promise<Store>;
  findStoreById(id: string): Promise<Store | null>;
  findStoreByHandle(handle: string): Promise<Store | null>;
  listStoresForOwner(ownerId: string): Promise<Store[]>;
  saveStore(store: Store): Promise<Store>;
  createProduct(product: Product): Promise<Product>;
  findProduct(storeId: string, productId: string): Promise<Product | null>;
  findProductByHandle(storeId:string,handle:string):Promise<Product|null>;
  searchProducts(storeId:string,query:Required<Pick<ProductQuery,"limit"|"offset"|"sort">>&ProductQuery):Promise<Product[]>;
  listProducts(storeId: string): Promise<Product[]>;
  productsForVariants(storeId:string,variantIds:string[]):Promise<Product[]>;
  saveProduct(product: Product): Promise<Product>;
  createCollection(collection:Collection):Promise<Collection>;
  findCollection(storeId:string,id:string):Promise<Collection|null>;
  findCollectionByHandle(storeId:string,handle:string):Promise<Collection|null>;
  searchCollections(storeId:string,query:CollectionQuery&{limit:number;offset:number}):Promise<Collection[]>;
  saveCollection(collection:Collection):Promise<Collection>;
  collectionProduct(storeId:string,collectionId:string,productId:string,position:number|null,version:number):Promise<Collection>;
  createVariant(storeId:string,productId:string,variant:Variant):Promise<Variant>;
  saveVariant(storeId:string,productId:string,variant:Variant):Promise<Variant>;
  skuExists(storeId: string, sku: string, exceptProductId?: string): Promise<boolean>;
  adjustStock(input: {
    storeId: string; variantId: string; after: number; reason: string;
    note: string; actorSubjectId: string;
  }): Promise<InventoryMovement>;
  listMovements(storeId: string): Promise<InventoryMovement[]>;
}


export interface CommerceAuthorizationPort {
  assertStoreAccess(store: Store, subjectId: string): Promise<void>;
}
export const COMMERCE_AUTHORIZATION = Symbol("COMMERCE_AUTHORIZATION");
