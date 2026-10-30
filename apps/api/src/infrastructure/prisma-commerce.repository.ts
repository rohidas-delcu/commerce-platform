import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client.js";
import { checkedStockChange, DomainError, assertVariantUpdate, assertProductActivation, optionRecord } from "../domain/commerce.js";
import type { Store, Product, InventoryMovement, ProductQuery, Variant, Collection, CollectionQuery } from "../domain/commerce.js";
import type { CommerceRepository } from "../application/commerce.port.js";

function storeDomain(row: {
  merchant?: {status: string}; suspended?: boolean; archivedAt?: Date | null;
  id: string; ownerSubjectId: string; name: string; handle: string;
  countryCode: string; currencyCode: string; status: string; createdAt: Date;
}): Store {
  return {
    merchantManaged: row.merchant ? row.merchant.status !== "QUARANTINED" : false, merchantStatus: row.merchant?.status, suspended: row.suspended, archivedAt: row.archivedAt?.toISOString() ?? null,
    id: row.id, ownerSubjectId: row.ownerSubjectId, name: row.name, handle: row.handle,
    countryCode: row.countryCode, currencyCode: row.currencyCode,
    status: row.status as Store["status"], createdAt: row.createdAt.toISOString()
  };
}

function productDomain(row: {
  seoTitle?: string; seoDescription?:string;
  id: string; storeId: string; version: number; name: string; handle: string; description: string;
  collection: string; priceMinor: bigint; compareMinor: bigint | null;
  status: string; createdAt: Date;
  variants: Array<{ id: string; name: string; sku: string; stock: number; active?:boolean; priceMinor?:bigint|null;compareMinor?:bigint|null;options?:unknown }>;
}): Product {
  return {
    seoTitle:row.seoTitle??"",seoDescription:row.seoDescription??"",
    id: row.id, storeId: row.storeId, version: row.version, name: row.name, handle: row.handle,
    description: row.description, collection: row.collection,
    priceMinor: row.priceMinor.toString(), compareMinor: row.compareMinor?.toString() ?? null,
    status: row.status as Product["status"], createdAt: row.createdAt.toISOString(),
    variants: row.variants.map(variantDomain)
  };
}


function variantDomain(row:{id:string;name:string;sku:string;stock:number;active?:boolean;priceMinor?:bigint|null;compareMinor?:bigint|null;options?:unknown}):Variant{
  return{id:row.id,name:row.name,sku:row.sku,stock:row.stock,active:row.active??true,priceMinor:row.priceMinor?.toString()??null,compareMinor:row.compareMinor?.toString()??null,options:optionRecord(row.options??{})};
}
function variantData(variant:Variant){return{name:variant.name,sku:variant.sku,active:variant.active??true,priceMinor:variant.priceMinor?BigInt(variant.priceMinor):null,compareMinor:variant.compareMinor?BigInt(variant.compareMinor):null,options:variant.options??{}};}

function movementDomain(row: {
  id: string; storeId: string; variantId: string; before: number; after: number;
  delta: number; reason: string; note: string; actorSubjectId: string; createdAt: Date;
}): InventoryMovement {
  return { ...row, reason: row.reason as InventoryMovement["reason"], createdAt: row.createdAt.toISOString() };
}

@Injectable()
export class PrismaCommerceRepository implements CommerceRepository, OnModuleDestroy, OnModuleInit {
  private readonly db: PrismaClient | Prisma.TransactionClient;

  constructor(transaction?: Prisma.TransactionClient) {
    if (transaction) {this.db = transaction; return;}
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required for DATA_DRIVER=postgres.");
    this.db = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000, max: 10 }, { schema: new URL(connectionString).searchParams.get("schema") ?? "public" }) });
  }

  async onModuleInit() { if ("$connect" in this.db) await this.db.$connect(); await this.checkHealth(); }

  async checkHealth() {
    // Adapter-generated queries honor the configured PostgreSQL schema.
    await Promise.all([
      this.db.store.findFirst({ select: { id: true, merchantId:true, settingsVersion:true } }),
      this.db.product.findFirst({ select: { version: true, seoTitle:true } }),
      this.db.productVariant.findFirst({ select: { stock: true, active:true,priceMinor:true,options:true } }),
      this.db.collection.findFirst({select:{id:true}}),
      this.db.collectionProduct.findFirst({select:{productId:true}}),
      this.db.inventoryMovement.findFirst({ select: { delta: true } })
    ]);
  }

  async onModuleDestroy() { if ("$disconnect" in this.db) await this.db.$disconnect(); }

  async createStore(store: Store): Promise<Store> {
    try {
      const account = await this.db.merchantAccount.upsert({where:{legacySubject:store.ownerSubjectId},create:{legacySubject:store.ownerSubjectId,name:"Unmapped legacy owner",status:"QUARANTINED"},update:{}});
      const row = await this.db.store.create({ data: {
        merchantId: account.id, id: store.id, ownerSubjectId: store.ownerSubjectId, name: store.name, handle: store.handle,
        countryCode: store.countryCode, currencyCode: store.currencyCode, status: store.status
      } });
      return storeDomain(row);
    } catch (error) { throw this.translateConflict(error); }
  }

  async findStoreById(id: string) {
    const row = await this.db.store.findUnique({ where: { id }, include: {merchant: {select: {status: true}}} });
    return row ? storeDomain(row) : null;
  }

  async findStoreByHandle(handle: string) {
    const row = await this.db.store.findUnique({ where: { handle }, include: {merchant: {select: {status: true}}} });
    return row ? storeDomain(row) : null;
  }

  async listStoresForOwner(ownerId: string) {
    return (await this.db.store.findMany({ where: { ownerSubjectId: ownerId, merchant: {status:"QUARANTINED"} }, orderBy: { createdAt: "desc" } })).map(storeDomain);
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
          seoTitle:product.seoTitle??"",seoDescription:product.seoDescription??"",
          id: product.id, store: { connect: { id: product.storeId } }, name: product.name,
          handle: product.handle, description: product.description, collection: product.collection,
          priceMinor: BigInt(product.priceMinor), compareMinor: product.compareMinor === null ? null : BigInt(product.compareMinor),
          status: product.status, variants: { create: product.variants.map(v => ({
            id: v.id, ...variantData(v), stock: v.stock
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


  async findProductByHandle(storeId:string,handle:string){const row=await this.db.product.findUnique({where:{storeId_handle:{storeId,handle}},include:{variants:true}});return row?productDomain(row):null;}
  async searchProducts(storeId:string,query:Required<Pick<ProductQuery,'limit'|'offset'|'sort'>>&ProductQuery){
    const where:Prisma.ProductWhereInput={storeId,...(query.status?{status:query.status}:{}),...(query.collection?{collection:{equals:query.collection,mode:'insensitive'}}:{})};
    if(query.query)where.OR=[{name:{contains:query.query,mode:'insensitive'}},{handle:{contains:query.query,mode:'insensitive'}},{description:{contains:query.query,mode:'insensitive'}}];
    if(query.collectionId)where.collectionLinks={some:{collectionId:query.collectionId}};
    if(query.collectionId&&query.collectionPosition)return(await this.db.collectionProduct.findMany({where:{storeId,collectionId:query.collectionId,product:where},orderBy:[{position:'asc'},{productId:'asc'}],skip:query.offset,take:query.limit+1,include:{product:{include:{variants:true}}}})).map(link=>productDomain(link.product));
    const orderBy:Prisma.ProductOrderByWithRelationInput[]=query.sort==='name'?[{name:'asc'},{id:'asc'}]:query.sort==='price_asc'?[{priceMinor:'asc'},{id:'asc'}]:query.sort==='price_desc'?[{priceMinor:'desc'},{id:'asc'}]:[{createdAt:'desc'},{id:'asc'}];
    return (await this.db.product.findMany({where,orderBy,skip:query.offset,take:query.limit+1,include:{variants:true}})).map(productDomain);
  }
  async listProducts(storeId: string) {
    return (await this.db.product.findMany({
      where: { storeId }, include: { variants: true }, orderBy: { createdAt: "desc" }
    })).map(productDomain);
  }

  async saveProduct(product: Product) {
    try {
      return await this.transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${product.id}::uuid AND "storeId"=${product.storeId}::uuid FOR UPDATE`;
      const current=await tx.product.findFirst({where:{id:product.id,storeId:product.storeId},include:{variants:true}});
      if(!current)throw new DomainError('NOT_FOUND','Product not found.');
      assertProductActivation({...product,variants:productDomain(current).variants});
      const row = await tx.product.update({
        where: { id: product.id, storeId: product.storeId, version: product.version },
        data: {
          seoTitle:product.seoTitle??"",seoDescription:product.seoDescription??"",
          version: { increment: 1 }, name: product.name, handle: product.handle, description: product.description,
          collection: product.collection, priceMinor: BigInt(product.priceMinor),
          compareMinor: product.compareMinor === null ? null : BigInt(product.compareMinor), status: product.status
        }, include: { variants: true }
      });
      return productDomain(row);
      });
    } catch (error) { throw this.translateConflict(error); }
  }


  async createVariant(storeId:string,productId:string,variant:Variant){return this.writeVariant(storeId,productId,variant,true);}
  async saveVariant(storeId:string,productId:string,variant:Variant){return this.writeVariant(storeId,productId,variant,false);}
  private async writeVariant(storeId:string,productId:string,variant:Variant,creating:boolean){
    try{return await this.transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
      const row=await tx.product.findFirst({where:{id:productId,storeId},include:{variants:true}});
      if(!row)throw new DomainError('NOT_FOUND','Product not found.');assertVariantUpdate(productDomain(row),variant,creating);
      const saved=creating?await tx.productVariant.create({data:{id:variant.id,storeId,productId,...variantData(variant),stock:0}}):await tx.productVariant.update({where:{id:variant.id,storeId,productId},data:variantData(variant)});
      return variantDomain(saved);
    });}catch(error){throw this.translateConflict(error);}
  }

  async createCollection(collection:Collection){try{const row=await this.db.collection.create({data:collection});return{...row,status:row.status as Collection['status']};}catch(error){throw this.translateConflict(error);}}
  async findCollection(storeId:string,id:string){const row=await this.db.collection.findFirst({where:{storeId,id}});return row?{...row,status:row.status as Collection['status']}:null;}
  async findCollectionByHandle(storeId:string,handle:string){const row=await this.db.collection.findUnique({where:{storeId_handle:{storeId,handle}}});return row?{...row,status:row.status as Collection['status']}:null;}
  async searchCollections(storeId:string,query:CollectionQuery&{limit:number;offset:number}){const rows=await this.db.collection.findMany({where:{storeId,...(query.status?{status:query.status}:{}),...(query.featured!==undefined?{featured:query.featured}:{}),...(query.query?{OR:[{name:{contains:query.query,mode:'insensitive'}},{handle:{contains:query.query,mode:'insensitive'}},{description:{contains:query.query,mode:'insensitive'}}]}:{})},skip:query.offset,take:query.limit+1,orderBy:[{position:'asc'},{id:'asc'}]});return rows.map(c=>({...c,status:c.status as Collection['status']}));}
  async saveCollection(collection:Collection){try{const{id,storeId,version,...data}=collection;const row=await this.db.collection.update({where:{id,storeId,version},data:{...data,version:{increment:1}}});return{...row,status:row.status as Collection['status']};}catch(error){throw this.translateConflict(error);}}
  async collectionProduct(storeId:string,collectionId:string,productId:string,position:number|null,version:number){
    try{return await this.transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Collection" WHERE id=${collectionId}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
      const c=await tx.collection.findFirst({where:{id:collectionId,storeId}}),p=await tx.product.findFirst({where:{id:productId,storeId},select:{id:true}});
      if(!c||!p)throw new DomainError('NOT_FOUND','Collection or product not found.');if(c.status!=='ACTIVE'||c.version!==version)throw new DomainError('CONFLICT','Collection changed or archived.');
      if(position===null)await tx.collectionProduct.deleteMany({where:{storeId,collectionId,productId}});else await tx.collectionProduct.upsert({where:{collectionId_productId:{collectionId,productId}},create:{storeId,collectionId,productId,position},update:{position}});
      const row=await tx.collection.update({where:{id:collectionId},data:{version:{increment:1}}});return{...row,status:row.status as Collection['status']};
    });}catch(error){throw this.translateConflict(error);}
  }
  async skuExists(storeId: string, sku: string, exceptProductId?: string) {
    return !!(await this.db.productVariant.findFirst({ where: {
      storeId, sku, ...(exceptProductId ? { productId: { not: exceptProductId } } : {})
    }, select: { id: true } }));
  }

  async adjustStock(input: { storeId: string; variantId: string; after: number; reason: string; note: string; actorSubjectId: string }) {
    try {
      return await this.transaction(async tx => {
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

  private transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return "$transaction" in this.db ? this.db.$transaction(work) : work(this.db);
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
