import {PrismaClient,type Prisma} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {DomainError} from '../../domain/commerce.js';
import {IdentityError} from '../../identity/domain/identity.js';
import {withStorefrontSession} from '../../infrastructure/storefront-session.js';
import {availableStock} from '../../inventory/domain/inventory.js';
import {cartQuantity,cartVersion,type Cart} from '../domain/cart.js';
import type {CartContext,CartRepositoryPort} from '../application/cart.port.js';
const include={lines:{orderBy:{variantId:'asc' as const}}};
type Row=Prisma.CartGetPayload<{include:typeof include}>;
const domain=(row:Row):Cart=>({...row,status:row.status as Cart['status'],lines:row.lines.map(line=>({variantId:line.variantId,quantity:line.quantity,priceSeenMinor:line.priceSeenMinor.toString()}))});
const expires=()=>new Date(Date.now()+7*86400000);
export class PrismaCartRepository implements CartRepositoryPort {
  private client?:PrismaClient;
  private get db(){if(this.client)return this.client;const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');return this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:10},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}
  async onModuleInit(){if(process.env.DATA_DRIVER==='postgres')await this.checkHealth();}
  async onModuleDestroy(){await this.client?.$disconnect();}
  async checkHealth(){await Promise.all([this.db.cart.findFirst({select:{id:true}}),this.db.cartLine.findFirst({select:{cartId:true}})]);}
  private scope<T>(c:CartContext,work:(tx:Prisma.TransactionClient,customerId:string|null)=>Promise<T>){return withStorefrontSession(this.db,c.storeId,c.principal,false,work);}
  private owned(tx:Prisma.TransactionClient,c:CartContext,customerId:string|null){return customerId?tx.cart.findFirst({where:{storeId:c.storeId,customerId,status:{in:['ACTIVE','EXPIRED']}},orderBy:[{status:'asc'},{createdAt:'desc'},{id:'asc'}],include}):null;}
  private async guest(tx:Prisma.TransactionClient,c:CartContext){if(!c.capability)return null;const row=await tx.cart.findFirst({where:{id:c.capability.id,storeId:c.storeId,customerId:null,secretDigest:c.capability.digest},include});return row;}
  private async load(tx:Prisma.TransactionClient,c:CartContext,customerId:string|null){
    const row=await this.owned(tx,c,customerId)??await this.guest(tx,c);if(!row||!['ACTIVE','EXPIRED'].includes(row.status))throw new DomainError('NOT_FOUND','Cart not found.');
    if(row.status==='ACTIVE'&&row.expiresAt<=new Date())return tx.cart.update({where:{id:row.id},data:{status:'EXPIRED',version:{increment:1}},include});return row;
  }
  create(c:CartContext,guest:{id:string;digest:string}){return this.scope(c,async(tx,customerId)=>{
    const previous=await this.owned(tx,c,customerId)??(!customerId?await this.guest(tx,c):null);
    if(previous?.status==='ACTIVE'&&previous.expiresAt>new Date())return{cart:domain(previous),createdGuest:false};
    if(previous?.status==='ACTIVE')await tx.cart.update({where:{id:previous.id},data:{status:'EXPIRED',version:{increment:1}}});
    const row=await tx.cart.create({data:{id:guest.id,storeId:c.storeId,customerId,secretDigest:customerId?null:guest.digest,expiresAt:expires()},include});return{cart:domain(row),createdGuest:!customerId};
  });}
  current(c:CartContext){return this.scope(c,async(tx,customerId)=>domain(await this.load(tx,c,customerId)));}
  update(c:CartContext,version:number,operation:Parameters<CartRepositoryPort['update']>[2]){return this.scope(c,async(tx,customerId)=>{
    const row=await this.load(tx,c,customerId);cartVersion(domain(row),version);
    if(operation.type==='set'){
      cartQuantity(operation.quantity);
      const variant=await tx.productVariant.findFirst({where:{id:operation.variantId,storeId:c.storeId,active:true,product:{status:'ACTIVE'}},include:{product:{select:{priceMinor:true}}}});
      if(!variant)throw new DomainError('NOT_FOUND','Purchasable variant not found.');
      if(availableStock(variant.stock,variant.reserved)<operation.quantity)throw new DomainError('CONFLICT','Insufficient available stock.');
      if(row.lines.length>=100&&!row.lines.some(l=>l.variantId===variant.id))throw new DomainError('CONFLICT','Cart item limit reached.');
      const priceSeenMinor=variant.priceMinor??variant.product.priceMinor;
      await tx.cartLine.upsert({where:{cartId_variantId:{cartId:row.id,variantId:variant.id}},create:{storeId:c.storeId,cartId:row.id,variantId:variant.id,quantity:operation.quantity,priceSeenMinor},update:{quantity:operation.quantity,priceSeenMinor}});
    }else if(operation.type==='remove')await tx.cartLine.deleteMany({where:{cartId:row.id,storeId:c.storeId,variantId:operation.variantId}});
    else if(operation.type==='clear')await tx.cartLine.deleteMany({where:{cartId:row.id,storeId:c.storeId}});
    else for(const line of row.lines){const variant=await tx.productVariant.findFirst({where:{id:line.variantId,storeId:c.storeId,active:true,product:{status:'ACTIVE'}},include:{product:{select:{priceMinor:true}}}});if(variant)await tx.cartLine.update({where:{cartId_variantId:{cartId:row.id,variantId:line.variantId}},data:{priceSeenMinor:variant.priceMinor??variant.product.priceMinor}});}
    return domain(await tx.cart.update({where:{id:row.id},data:{version:{increment:1},...(row.customerId?{expiresAt:expires()}:{})},include}));
  });}
  merge(c:CartContext,version:number,guestVersion:number){return this.scope(c,async(tx,customerId)=>{
    if(!customerId)throw new IdentityError(401,'Authentication required.');
    let target=await this.owned(tx,c,customerId);const source=await this.guest(tx,c);
    if(!source){if(target&&target.expiresAt>new Date())return domain(target);throw new DomainError('NOT_FOUND','Guest cart not found.');}
    if(source.status==='MERGED'){
      if(!source.mergedIntoId)throw new DomainError('CONFLICT','Invalid merged cart.');
      const prior=await tx.cart.findFirst({where:{id:source.mergedIntoId,storeId:c.storeId,customerId,status:'ACTIVE'},include});
      if(prior&&prior.expiresAt>new Date())return domain(prior);throw new DomainError('CONFLICT','Merged cart is no longer active.');
    }
    cartVersion(domain(source),guestVersion);
    if(target&&target.expiresAt<=new Date()){await tx.cart.update({where:{id:target.id},data:{status:'EXPIRED',version:{increment:1}}});target=null;}
    if(!target){if(version!==0)throw new DomainError('CONFLICT','Cart changed.');target=await tx.cart.create({data:{storeId:c.storeId,customerId,expiresAt:expires()},include});}
    cartVersion(domain(target),version);
    const combined=new Map(target.lines.map(line=>[line.variantId,{quantity:line.quantity,priceSeenMinor:line.priceSeenMinor}]));
    for(const line of source.lines){const previous=combined.get(line.variantId);combined.set(line.variantId,{quantity:cartQuantity((previous?.quantity??0)+line.quantity),priceSeenMinor:previous?.priceSeenMinor??line.priceSeenMinor});}
    if(combined.size>100)throw new DomainError('CONFLICT','Merged cart exceeds item limit.');
    for(const[variantId,line]of combined)await tx.cartLine.upsert({where:{cartId_variantId:{cartId:target.id,variantId}},create:{storeId:c.storeId,cartId:target.id,variantId,...line},update:line});
    await tx.cart.update({where:{id:source.id},data:{status:'MERGED',mergedIntoId:target.id,version:{increment:1}}});
    return domain(await tx.cart.update({where:{id:target.id},data:{version:{increment:1},expiresAt:expires()},include}));
  });}
}
