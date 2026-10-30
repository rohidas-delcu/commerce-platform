import {orderQuery,orderProjection,type OrderQuery,type OrderAction} from '../orders/domain/orders.js';
import {pricingPolicy,assertPricingReady,type PricingPolicy} from '../pricing/domain/pricing.js';
import {InventoryService} from '../inventory/application/inventory.service.js';
import type {ReservationRequest} from '../inventory/domain/inventory.js';
import type {MediaAsset,ProductImage} from '../media/domain/media.js';
import { randomUUID } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { COMMERCE_REPOSITORY, COMMERCE_AUTHORIZATION } from "./commerce.port.js";
import type { CommerceRepository, CommerceAuthorizationPort } from "./commerce.port.js";
import { DomainError, normalizeHandle, normalizeMoneyMinor, validateProductInput, productQuery, publicProduct, seoText, variantMetadata, collectionMetadata } from "../domain/commerce.js";
import type { Product, Store, ProductQuery, Variant, Collection, CollectionQuery } from "../domain/commerce.js";

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
    priceMinor: string; compareMinor?: string | null; seoTitle?:string;seoDescription?:string;
    variants: Array<Omit<Variant,"id">>;
  }) {
    await this.ownedStore(storeId, subjectId);
    const validated = validateProductInput(input);
    const product: Product = {
      seoTitle:seoText(input.seoTitle,70),seoDescription:seoText(input.seoDescription,320),
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
    priceMinor?: string; compareMinor?: string | null;seoTitle?:string;seoDescription?:string;
  }) {
    await this.ownedStore(storeId, subjectId);
    const product = await this.repository.findProduct(storeId, productId);
    if (!product) throw new DomainError("NOT_FOUND", "Product not found.");
    const name = input.name === undefined ? product.name : input.name.trim();
    if (!name || name.length > 150) throw new DomainError("INVALID", "Valid product name required.");
    product.name = name;
    if (input.handle !== undefined) product.handle = normalizeHandle(input.handle);
    if (input.seoTitle!==undefined)product.seoTitle=seoText(input.seoTitle,70);
    if (input.seoDescription!==undefined)product.seoDescription=seoText(input.seoDescription,320);
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
    if(product.status==="ARCHIVED")throw new DomainError("CONFLICT","Archived products cannot be activated.");
    if (!product.variants.some(v=>v.active!==false)) throw new DomainError("INVALID", "At least one variant is required.");
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



  async createVariant(subjectId:string,storeId:string,productId:string,input:Parameters<typeof variantMetadata>[0]){
    await this.ownedStore(storeId,subjectId);return this.repository.createVariant(storeId,productId,{id:randomUUID(),stock:0,...variantMetadata(input)});
  }
  async updateVariant(subjectId:string,storeId:string,productId:string,variantId:string,input:Partial<Parameters<typeof variantMetadata>[0]>){
    const product=await this.productDetail(subjectId,storeId,productId),current=product.variants.find(v=>v.id===variantId);
    if(!current)throw new DomainError('NOT_FOUND','Variant not found.');
    const next={...current,name:input.name===undefined?current.name:input.name,sku:input.sku===undefined?current.sku:input.sku,active:input.active===undefined?current.active:input.active,priceMinor:input.priceMinor===undefined?current.priceMinor:input.priceMinor,compareMinor:input.compareMinor===undefined?current.compareMinor:input.compareMinor,options:input.options===undefined?current.options:input.options};
    if(input.priceMinor===null&&input.compareMinor===undefined)next.compareMinor=null;
    return this.repository.saveVariant(storeId,productId,{id:variantId,stock:current.stock,...variantMetadata(next)});
  }
  async productDetail(subjectId:string,storeId:string,id:string){await this.ownedStore(storeId,subjectId);const product=await this.repository.findProduct(storeId,id);if(!product)throw new DomainError('NOT_FOUND','Product not found.');return product;}
  async productState(subjectId:string,storeId:string,id:string,state:'DRAFT'|'ARCHIVED'){
    const product=await this.productDetail(subjectId,storeId,id);if(product.status==='ARCHIVED'&&state!=='ARCHIVED')throw new DomainError('CONFLICT','Archived product cannot be restored implicitly.');
    product.status=state;return this.repository.saveProduct(product);
  }
  async queryProducts(subjectId:string,storeId:string,input:ProductQuery={}){await this.ownedStore(storeId,subjectId);return this.page(storeId,productQuery(input));}

  async createCollection(subjectId:string,storeId:string,input:Parameters<typeof collectionMetadata>[0]){await this.ownedStore(storeId,subjectId);return this.repository.createCollection({id:randomUUID(),storeId,...collectionMetadata(input),version:0,status:'ACTIVE'});}
  async collectionDetail(subjectId:string,storeId:string,id:string){await this.ownedStore(storeId,subjectId);const c=await this.repository.findCollection(storeId,id);if(!c)throw new DomainError('NOT_FOUND','Collection not found.');return c;}
  async updateCollection(subjectId:string,storeId:string,id:string,input:Partial<Parameters<typeof collectionMetadata>[0]>&{expectedVersion:number}){
    const current=await this.collectionDetail(subjectId,storeId,id);if(current.status==='ARCHIVED'||current.version!==input.expectedVersion)throw new DomainError('CONFLICT','Collection changed or archived.');
    const metadata=collectionMetadata({name:input.name===undefined?current.name:input.name,handle:input.handle===undefined?current.handle:input.handle,description:input.description===undefined?current.description:input.description,featured:input.featured===undefined?current.featured:input.featured,position:input.position===undefined?current.position:input.position});
    return this.repository.saveCollection({...current,...metadata});
  }
  async archiveCollection(subjectId:string,storeId:string,id:string,version:number){const current=await this.collectionDetail(subjectId,storeId,id);if(current.version!==version)throw new DomainError('CONFLICT','Collection changed.');return this.repository.saveCollection({...current,status:'ARCHIVED'});}
  async linkCollectionProduct(subjectId:string,storeId:string,collectionId:string,productId:string,position:number|null,version:number){await this.ownedStore(storeId,subjectId);if(position!==null&&(!Number.isInteger(position)||position<0||position>1000000))throw new DomainError('INVALID','Invalid product position.');if(!Number.isInteger(version)||version<0)throw new DomainError('INVALID','Invalid collection version.');return this.repository.collectionProduct(storeId,collectionId,productId,position,version);}
  private async collectionPage(storeId:string,input:CollectionQuery={}){
    const page=productQuery({query:input.query,limit:input.limit,offset:input.offset});
    if(input.status&&!['ACTIVE','ARCHIVED'].includes(input.status))throw new DomainError('INVALID','Invalid collection status.');
    const rows=await this.repository.searchCollections(storeId,{...input,query:page.query,status:input.status??'ACTIVE',limit:page.limit,offset:page.offset});
    return{items:rows.slice(0,page.limit),limit:page.limit,offset:page.offset,nextOffset:rows.length>page.limit?page.offset+page.limit:null};
  }
  async collectionProducts(subjectId:string,storeId:string,id:string,input:ProductQuery={}){await this.collectionDetail(subjectId,storeId,id);return this.page(storeId,productQuery({...input,collectionId:id,collectionPosition:input.sort===undefined}));}
  async collections(subjectId:string,storeId:string,input:CollectionQuery={}){await this.ownedStore(storeId,subjectId);return this.collectionPage(storeId,input);}
  async publicCollections(handle:string,input:CollectionQuery={}){const store=await this.publishedStore(handle),page=await this.collectionPage(store.id,{...input,status:'ACTIVE'});return{collections:page.items.map(c=>({id:c.id,name:c.name,handle:c.handle,description:c.description,featured:c.featured})),pagination:{limit:page.limit,offset:page.offset,nextOffset:page.nextOffset}};}
  async publicCollection(handle:string,collectionHandle:string,input:ProductQuery={}){
    const store=await this.publishedStore(handle),collection=await this.repository.findCollectionByHandle(store.id,normalizeHandle(collectionHandle));if(!collection||collection.status!=='ACTIVE')throw new DomainError('NOT_FOUND','Collection not found.');
    const page=await this.page(store.id,productQuery({...input,status:'ACTIVE',collectionId:collection.id,collectionPosition:input.sort===undefined}));
    return{collection:{id:collection.id,name:collection.name,handle:collection.handle,description:collection.description,featured:collection.featured},products:page.items.map(publicProduct),pagination:{limit:page.limit,offset:page.offset,nextOffset:page.nextOffset}};
  }

  async reserveMedia(subjectId:string,storeId:string,asset:MediaAsset){await this.ownedStore(storeId,subjectId);if(asset.storeId!==storeId)throw new DomainError('NOT_FOUND','Asset not found.');return this.repository.media.reserve(asset);}
  async mediaAsset(subjectId:string,storeId:string,id:string){await this.ownedStore(storeId,subjectId);const asset=await this.repository.media.asset(id);if(!asset||asset.storeId!==storeId)throw new DomainError('NOT_FOUND','Asset not found.');return asset;}
  async completeMedia(subjectId:string,storeId:string,id:string){await this.ownedStore(storeId,subjectId);return this.repository.media.complete(storeId,id);}
  async removeMedia(subjectId:string,storeId:string,id:string){await this.ownedStore(storeId,subjectId);return this.repository.media.remove(storeId,id);}
  async setImages(subjectId:string,storeId:string,productId:string,images:ProductImage[],version:number){await this.ownedStore(storeId,subjectId);await this.repository.media.setImages(storeId,productId,images,version);return this.repository.findProduct(storeId,productId);}
  private async page(storeId:string,query:ReturnType<typeof productQuery>){const found=await this.repository.searchProducts(storeId,query);return{items:found.slice(0,query.limit),limit:query.limit,offset:query.offset,nextOffset:found.length>query.limit?query.offset+query.limit:null};}
  private async publishedStore(handle:string){
    const store=await this.repository.findStoreByHandle(normalizeHandle(handle));
    if(!store||store.status!=='PUBLISHED'||store.suspended||store.archivedAt||(store.merchantStatus&&!['ACTIVE','QUARANTINED'].includes(store.merchantStatus)))throw new DomainError('NOT_FOUND','Store not found.');
    return store;
  }
  async publicCatalog(handle:string,input:ProductQuery={}){
    const store=await this.publishedStore(handle),page=await this.page(store.id,productQuery({...input,status:'ACTIVE'}));
    return{store:{handle:store.handle,name:store.name,currencyCode:store.currencyCode,countryCode:store.countryCode},products:page.items.map(publicProduct),pagination:{limit:page.limit,offset:page.offset,nextOffset:page.nextOffset}};
  }
  async publicProductDetail(handle:string,productHandle:string){const store=await this.publishedStore(handle),product=await this.repository.findProductByHandle(store.id,normalizeHandle(productHandle));if(!product||product.status!=='ACTIVE')throw new DomainError('NOT_FOUND','Product not found.');return publicProduct(product);}

  async reserveInventory(subject:string,storeId:string,input:ReservationRequest){await this.ownedStore(storeId,subject);return new InventoryService(this.repository.inventory).reserve(storeId,input,subject);}
  async inventoryReservation(subject:string,storeId:string,id:string){await this.ownedStore(storeId,subject);return new InventoryService(this.repository.inventory).find(storeId,id);}
  async releaseInventory(subject:string,storeId:string,id:string){await this.ownedStore(storeId,subject);return new InventoryService(this.repository.inventory).transition(storeId,id,'release',subject);}
  async expireInventory(subject:string,storeId:string){await this.ownedStore(storeId,subject);return new InventoryService(this.repository.inventory).expire(storeId,subject);}

  async pricing(subject:string,storeId:string){await this.ownedStore(storeId,subject);return this.repository.pricing.policy(storeId);}
  async savePricing(subject:string,storeId:string,input:PricingPolicy){const store=await this.ownedStore(storeId,subject);const policy=pricingPolicy(input);if(store.status==='PUBLISHED')assertPricingReady(policy);if(policy.payments.simulator&&process.env.NODE_ENV!=='development')throw new DomainError('INVALID','Payment simulator is development-only.');return this.repository.pricing.savePolicy(storeId,policy,subject);}

  async orders(subject:string,storeId:string,input:OrderQuery){await this.ownedStore(storeId,subject);const query=orderQuery(input),found=await this.repository.orders.list(storeId,query);return{items:found.slice(0,query.limit).map(order=>orderProjection(order,true)),limit:query.limit,offset:query.offset,nextOffset:found.length>query.limit?query.offset+query.limit:null};}
  async order(subject:string,storeId:string,id:string){await this.ownedStore(storeId,subject);const order=await this.repository.orders.find(storeId,id);if(!order)throw new DomainError('NOT_FOUND','Order not found.');return orderProjection(order,true);}

  async orderCommand(subject:string,storeId:string,id:string,input:{expectedVersion:number;key:string;action:OrderAction}){await this.ownedStore(storeId,subject);if(typeof input.key!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(input.key))throw new DomainError('INVALID','Stable command key required.');return orderProjection(await this.repository.orders.command(storeId,id,input,subject),true);}
}
