import {MemoryInventoryRepository} from '../inventory/infrastructure/memory-inventory.repository.js';
import {MemoryMediaRepository} from '../media/infrastructure/memory-media.repository.js';
import { randomUUID } from "node:crypto";
import { checkedStockChange, DomainError, assertVariantUpdate, assertProductActivation } from "../domain/commerce.js";
import type { InventoryMovement, Product, Store, ProductQuery, Variant, Collection, CollectionQuery } from "../domain/commerce.js";
import type { CommerceRepository } from "../application/commerce.port.js";

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryCommerceRepository implements CommerceRepository {
  private readonly stores = new Map<string, Store>();
  private readonly products = new Map<string, Product>();
  readonly media=new MemoryMediaRepository(this.stores,this.products);
  private readonly collections=new Map<string,Collection>();
  private readonly collectionLinks=new Map<string,{collectionId:string;productId:string;position:number}>();
  private readonly movements: InventoryMovement[] = [];
  readonly inventory=new MemoryInventoryRepository(this.stores,this.products,this.movements);

  async checkHealth() {}

  constructor(seed = true) {
    if (process.env.NODE_ENV === "production") throw new Error("Memory mode is development-only.");
    if (!seed) return;
    const store: Store = {
      id: randomUUID(), ownerSubjectId: "demo-merchant", name: "Northline Goods",
      handle: "northline-goods", countryCode: "IN", currencyCode: "INR",
      status: "PUBLISHED", createdAt: new Date().toISOString()
    };
    const product: Product = {
      id: randomUUID(), storeId: store.id, version: 0, name: "Everyday Essentials Watch",
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
      if ([...this.products.values()].some(p => p.storeId === product.storeId && p.variants.some(v => v.sku === variant.sku)))
        throw new DomainError("CONFLICT", "SKU already exists in this store.");
    }
    this.products.set(product.id, clone(product)); return clone(product);
  }
  async findProduct(storeId: string, productId: string) {
    const p = this.products.get(productId);
    return p?.storeId === storeId ? clone(p) : null;
  }

  async findProductByHandle(storeId:string,handle:string){return clone([...this.products.values()].find(p=>p.storeId===storeId&&p.handle===handle)??null);}
  async searchProducts(storeId:string,query:Required<Pick<ProductQuery,'limit'|'offset'|'sort'>>&ProductQuery){
    const term=(query.query??'').toLowerCase();
    const rows=[...this.products.values()].filter(p=>p.storeId===storeId&&(!query.status||p.status===query.status)&&(!query.collection||p.collection.toLowerCase()===query.collection.toLowerCase())&&(!query.collectionId||this.collectionLinks.has(query.collectionId+':'+p.id))&&(!term||[p.name,p.handle,p.description].some(v=>v.toLowerCase().includes(term))));
    rows.sort((a,b)=>{let result=0;if(query.collectionId&&query.collectionPosition)result=this.collectionLinks.get(query.collectionId+':'+a.id)!.position-this.collectionLinks.get(query.collectionId+':'+b.id)!.position;else if(query.sort==='price_asc'||query.sort==='price_desc'){result=BigInt(a.priceMinor)<BigInt(b.priceMinor)?-1:BigInt(a.priceMinor)>BigInt(b.priceMinor)?1:0;if(query.sort==='price_desc')result=-result;}else if(query.sort==='name')result=a.name<b.name?-1:a.name>b.name?1:0;else result=a.createdAt>b.createdAt?-1:a.createdAt<b.createdAt?1:0;return result||(a.id<b.id?-1:a.id>b.id?1:0);});
    return clone(rows.slice(query.offset,query.offset+query.limit+1));
  }
  async productsForVariants(storeId:string,variantIds:string[]){return clone([...this.products.values()].filter(p=>p.storeId===storeId&&p.variants.some(v=>variantIds.includes(v.id))));}
  async listProducts(storeId: string) { return clone([...this.products.values()].filter(p => p.storeId === storeId)); }
  async saveProduct(product: Product) {
    const current = this.products.get(product.id);
    if (!current || current.storeId !== product.storeId) throw new DomainError("NOT_FOUND", "Product not found.");
    if (current.version !== product.version) throw new DomainError("CONFLICT", "Product changed. Refresh and retry the update.");
    if ([...this.products.values()].some(p => p.storeId === product.storeId && p.handle === product.handle && p.id !== product.id))
      throw new DomainError("CONFLICT", "Product handle already exists in this store.");
    // Metadata writes must not replace inventory read before a concurrent adjustment.
    assertProductActivation({...product,variants:current.variants});
    const saved = { ...product, version: current.version + 1, variants: current.variants };
    this.products.set(product.id, clone(saved)); return clone(saved);
  }

  async createVariant(storeId:string,productId:string,variant:Variant){
    const product=this.products.get(productId);if(!product||product.storeId!==storeId)throw new DomainError('NOT_FOUND','Product not found.');
    assertVariantUpdate(product,variant,true);
    if([...this.products.values()].some(p=>p.storeId===storeId&&p.variants.some(v=>v.sku===variant.sku)))throw new DomainError('CONFLICT','SKU already exists.');
    product.variants.push(clone({...variant,stock:0}));return clone({...variant,stock:0});
  }
  async saveVariant(storeId:string,productId:string,variant:Variant){
    const product=this.products.get(productId);if(!product||product.storeId!==storeId)throw new DomainError('NOT_FOUND','Product not found.');
    assertVariantUpdate(product,variant,false);
    if([...this.products.values()].some(p=>p.storeId===storeId&&p.variants.some(v=>v.id!==variant.id&&v.sku===variant.sku)))throw new DomainError('CONFLICT','SKU already exists.');
    const index=product.variants.findIndex(v=>v.id===variant.id),saved={...variant,stock:product.variants[index].stock,reserved:product.variants[index].reserved??0};product.variants[index]=clone(saved);return clone(saved);
  }

  async createCollection(collection:Collection){if([...this.collections.values()].some(c=>c.storeId===collection.storeId&&c.handle===collection.handle))throw new DomainError('CONFLICT','Collection handle exists.');this.collections.set(collection.id,clone(collection));return clone(collection);}
  async findCollection(storeId:string,id:string){const c=this.collections.get(id);return c?.storeId===storeId?clone(c):null;}
  async findCollectionByHandle(storeId:string,handle:string){return clone([...this.collections.values()].find(c=>c.storeId===storeId&&c.handle===handle)??null);}
  async searchCollections(storeId:string,query:CollectionQuery&{limit:number;offset:number}){return clone([...this.collections.values()].filter(c=>c.storeId===storeId&&(!query.status||c.status===query.status)&&(query.featured===undefined||c.featured===query.featured)&&(!query.query||[c.name,c.handle,c.description].some(v=>v.toLowerCase().includes(query.query!.toLowerCase())))).sort((a,b)=>a.position-b.position||(a.id<b.id?-1:1)).slice(query.offset,query.offset+query.limit+1));}
  async saveCollection(collection:Collection){const current=this.collections.get(collection.id);if(!current||current.storeId!==collection.storeId)throw new DomainError('NOT_FOUND','Collection not found.');if(current.version!==collection.version)throw new DomainError('CONFLICT','Collection changed.');if([...this.collections.values()].some(c=>c.id!==collection.id&&c.storeId===collection.storeId&&c.handle===collection.handle))throw new DomainError('CONFLICT','Collection handle exists.');const saved={...collection,version:current.version+1};this.collections.set(collection.id,clone(saved));return clone(saved);}
  async collectionProduct(storeId:string,collectionId:string,productId:string,position:number|null,version:number){const c=this.collections.get(collectionId),p=this.products.get(productId);if(!c||c.storeId!==storeId||!p||p.storeId!==storeId)throw new DomainError('NOT_FOUND','Collection or product not found.');if(c.status!=='ACTIVE'||c.version!==version)throw new DomainError('CONFLICT','Collection changed or archived.');const key=collectionId+':'+productId;if(position===null)this.collectionLinks.delete(key);else this.collectionLinks.set(key,{collectionId,productId,position});c.version++;return clone(c);}
  async skuExists(storeId: string, sku: string, exceptProductId?: string) {
    return [...this.products.values()].some(p => p.storeId === storeId && p.id !== exceptProductId && p.variants.some(v => v.sku === sku));
  }
  async adjustStock(input: { storeId: string; variantId: string; after: number; reason: string; note: string; actorSubjectId: string }) {
    const product = [...this.products.values()].find(p => p.storeId === input.storeId && p.variants.some(v => v.id === input.variantId));
    const variant = product?.variants.find(v => v.id === input.variantId);
    if (!variant) throw new DomainError("NOT_FOUND", "Variant not found.");
    const before = variant.stock, delta = checkedStockChange(before, input.after, input.reason);
    if(input.after<(variant.reserved??0))throw new DomainError("CONFLICT","On-hand stock cannot fall below reserved stock.");
    variant.stock = input.after;
    const movement: InventoryMovement = {
      id: randomUUID(), storeId: input.storeId, variantId: variant.id, before, after: input.after,
      delta, reason: input.reason as InventoryMovement["reason"], note: input.note,
      actorSubjectId: input.actorSubjectId, createdAt: new Date().toISOString()
    };
    this.movements.unshift(movement);
    return clone(movement);
  }
  async listMovements(storeId: string) { return clone(this.movements.filter(m => m.storeId === storeId).slice(0, 200)); }
}
