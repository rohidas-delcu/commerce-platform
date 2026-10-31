import {placeCheckout} from './place-checkout.js';
import {assertCheckoutPaymentMutable,assertCartPaymentMutable} from '../../payments/infrastructure/payment-locks.js';
import {releaseCheckout,expireCheckout} from './checkout-lifecycle.js';
import {type OrderQuery} from '../../orders/domain/orders.js';
import {orderDomain,orderInclude} from '../../orders/infrastructure/prisma-orders.repository.js';
import {createHash} from 'node:crypto';
import {PrismaClient,Prisma} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {withStorefrontSession} from '../../infrastructure/storefront-session.js';
import {PrismaCommerceRepository} from '../../infrastructure/prisma-commerce.repository.js';
import {InventoryService} from '../../inventory/application/inventory.service.js';
import {DomainError} from '../../domain/commerce.js';
import {IdentityError} from '../../identity/domain/identity.js';
import {assertPricingReady,calculateQuote,assertCouponEligible} from '../../pricing/domain/pricing.js';
import {customerAddress,type AddressInput} from '../../customer/domain/customer.js';
import {checkoutContact,checkoutVersion,type Checkout,type CheckoutChanges,type CheckoutSnapshot,type CheckoutItem} from '../domain/checkout.js';
import type {CheckoutRepositoryPort,CheckoutContext} from '../application/checkout.port.js';
type Row=Prisma.CheckoutGetPayload<object>;
function domain(row:Row):Checkout{return{id:row.id,cartId:row.cartId,status:row.status as Checkout['status'],version:row.version,expiresAt:row.expiresAt,contactEmail:row.contactEmail,contactName:row.contactName,shippingMethodId:row.shippingMethodId,shippingAddress:row.shippingAddress as AddressInput|null,snapshot:row.snapshot as CheckoutSnapshot|null};}
export class PrismaCheckoutRepository implements CheckoutRepositoryPort {
  private client?:PrismaClient;
  private get db(){if(this.client)return this.client;const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');return this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:10},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}
  async onModuleInit(){if(process.env.DATA_DRIVER==='postgres')await this.checkHealth();}
  async onModuleDestroy(){await this.client?.$disconnect();}
  async checkHealth(){await this.db.checkout.findFirst({select:{id:true}});}
  private scope<T>(c:CheckoutContext,work:(tx:Prisma.TransactionClient,customerId:string)=>Promise<T>,access:'commerce'|'account'='commerce'){return withStorefrontSession(this.db,c.storeId,c.principal,true,(tx,id)=>{if(!id)throw new IdentityError(401,'Authentication required.');return work(tx,id);},access);}
  private async load(tx:Prisma.TransactionClient,c:CheckoutContext,customerId:string,id:string){
    await tx.$queryRaw`SELECT id FROM "Checkout" WHERE id=${id}::uuid AND "storeId"=${c.storeId}::uuid AND "customerId"=${customerId}::uuid FOR UPDATE`;
    const row=await tx.checkout.findFirst({where:{id,storeId:c.storeId,customerId}});if(!row)throw new DomainError('NOT_FOUND','Checkout not found.');return row;
  }
  private release(tx:Prisma.TransactionClient,row:Row,actor:string){return releaseCheckout(tx,row,actor);}
  private expire(tx:Prisma.TransactionClient,row:Row,actor:string){return expireCheckout(tx,row,actor);}
  private async audit(tx:Prisma.TransactionClient,actor:string,action:string,id:string){await tx.identityAudit.create({data:{identityId:actor,action:action+':'+id}});}
  start(c:CheckoutContext,cartId:string,cartVersion:number,key:string){return this.scope(c,async(tx,customerId)=>{
    const digest=createHash('sha256').update(JSON.stringify({cartId,cartVersion})).digest('hex');
    const prior=await tx.checkout.findUnique({where:{storeId_customerId_key:{storeId:c.storeId,customerId,key}}});
    if(prior){if(prior.digest!==digest)throw new DomainError('CONFLICT','Checkout key already used for different input.');return this.view(tx,await this.expire(tx,prior,customerId));}
    const cart=await tx.cart.findFirst({where:{id:cartId,storeId:c.storeId,customerId,status:'ACTIVE',expiresAt:{gt:new Date()}},include:{lines:true}});
    if(!cart)throw new DomainError('NOT_FOUND','Active customer cart not found.');if(!cart.lines.length||cart.version!==cartVersion)throw new DomainError('CONFLICT','Cart is empty or changed.');await assertCartPaymentMutable(tx,cart.id);
    const active=await tx.checkout.findFirst({where:{storeId:c.storeId,cartId,status:{in:['DRAFT','READY']}}});
    if(active&&['DRAFT','READY'].includes((await this.expire(tx,active,customerId)).status))throw new DomainError('CONFLICT','An active checkout already exists for this cart. Resume it.');
    const profile=await tx.identity.findUniqueOrThrow({where:{id:customerId},select:{name:true,email:true}});
    const saved=await tx.checkout.create({data:{storeId:c.storeId,customerId,cartId,cartVersion,key,digest,...checkoutContact(profile.email,profile.name),expiresAt:new Date(Date.now()+86400000)}});await this.audit(tx,customerId,'CHECKOUT_STARTED',saved.id);return domain(saved);
  });}
  private async view(tx:Prisma.TransactionClient,row:Row){const order=await tx.order.findFirst({where:{checkoutId:row.id,storeId:row.storeId,customerId:row.customerId},select:{id:true}});return{...domain(row),orderId:order?.id??null};}
  get(c:CheckoutContext,id:string){return this.scope(c,async(tx,customerId)=>this.view(tx,await this.expire(tx,await this.load(tx,c,customerId,id),customerId)));}
  configure(c:CheckoutContext,id:string,input:CheckoutChanges){return this.scope(c,async(tx,customerId)=>{
    const row=await this.load(tx,c,customerId,id);await assertCheckoutPaymentMutable(tx,id);checkoutVersion(domain(row),input.expectedVersion);
    const contact=checkoutContact(input.contactEmail??row.contactEmail,input.contactName??row.contactName);
    const address=input.shippingAddress?customerAddress(input.shippingAddress):null;
    await this.release(tx,row,customerId);
    await this.audit(tx,customerId,'CHECKOUT_CONFIGURED',id);
    return domain(await tx.checkout.update({where:{id},data:{...contact,...(address?{shippingAddress:{...address}}:{}),...(input.shippingMethodId!==undefined?{shippingMethodId:input.shippingMethodId}:{}),status:'DRAFT',version:{increment:1},snapshot:Prisma.DbNull,reservationId:null,expiresAt:new Date(row.createdAt.getTime()+86400000)}}));
  });}
  reserve(c:CheckoutContext,id:string,version:number){return this.scope(c,async(tx,customerId)=>{
    const row=await this.load(tx,c,customerId,id),existing=domain(row);
    if(row.status==='READY'&&row.expiresAt>new Date()&&existing.snapshot?.baseVersion===version)return existing;
    await assertCheckoutPaymentMutable(tx,id);checkoutVersion(existing,version);
    if(!row.shippingAddress||!row.shippingMethodId)throw new DomainError('CONFLICT','Shipping address and method required.');
    await this.release(tx,row,customerId);
    const repo=new PrismaCommerceRepository(tx),inventory=new InventoryService(repo.inventory);
    await inventory.expire(c.storeId,'checkout-expiry');
    const cart=await tx.cart.findFirst({where:{id:row.cartId,storeId:c.storeId,customerId,status:'ACTIVE',expiresAt:{gt:new Date()}},include:{lines:{orderBy:{variantId:'asc'}}}});
    if(!cart||!cart.lines.length)throw new DomainError('CONFLICT','Cart unavailable or empty.');
    const policy=await repo.pricing.policy(c.storeId);assertPricingReady(policy);if(!policy)throw new DomainError('CONFLICT','Pricing configuration required.');
    const products=await repo.productsForVariants(c.storeId,cart.lines.map(line=>line.variantId));
    const items:CheckoutItem[]=cart.lines.map(line=>{
      const product=products.find(p=>p.variants.some(v=>v.id===line.variantId)),variant=product?.variants.find(v=>v.id===line.variantId);
      if(!product||product.status!=='ACTIVE'||!variant||variant.active===false)throw new DomainError('CONFLICT','Cart contains unavailable products.');
      const unitPriceMinor=variant.priceMinor??product.priceMinor;
      return{productId:product.id,variantId:variant.id,productName:product.name,variantName:variant.name,sku:variant.sku,quantity:line.quantity,unitPriceMinor,subtotalMinor:(BigInt(unitPriceMinor)*BigInt(line.quantity)).toString()};
    });
    const coupon=cart.couponId?await repo.pricing.couponRule(c.storeId,cart.couponId,customerId,cart.id):null;
    if(cart.couponId&&!coupon)throw new DomainError('CONFLICT','Coupon unavailable.');
    const address=customerAddress(row.shippingAddress as unknown as AddressInput);
    const totals=calculateQuote(policy,{discount:coupon??undefined,subtotalMinor:items.reduce((sum,item)=>sum+BigInt(item.subtotalMinor),0n).toString(),countryCode:address.countryCode,shippingMethodId:row.shippingMethodId,customerId,now:new Date()});
    const reservation=await inventory.reserve(c.storeId,{key:row.id+'_'+row.version,lines:items.map(item=>({variantId:item.variantId,quantity:item.quantity}))},customerId);
    let couponHoldId:string|null=null;
    if(coupon){const[clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;assertCouponEligible(coupon,customerId,clock.now);const held=await tx.couponHold.create({data:{storeId:c.storeId,customerId,checkoutId:id,checkoutVersion:row.version+1,couponId:coupon.id,couponVersion:coupon.version,restoreOnCancellation:coupon.restoreOnCancellation,expiresAt:reservation.expiresAt}});couponHoldId=held.id;}
    const snapshot:CheckoutSnapshot={couponId:coupon?.id??null,couponVersion:coupon?.version??null,couponHoldId,baseVersion:version,cartVersion:cart.version,currencyCode:(await tx.store.findUniqueOrThrow({where:{id:c.storeId},select:{currencyCode:true}})).currencyCode,totals,shippingMethodName:policy.shipping.find(m=>m.id===row.shippingMethodId)!.name,items};
    const json={...snapshot,items:items.map(item=>({...item}))};
    await this.audit(tx,customerId,'CHECKOUT_RESERVED',id);
    return domain(await tx.checkout.update({where:{id},data:{status:'READY',version:{increment:1},cartVersion:cart.version,snapshot:json,reservationId:reservation.id,expiresAt:reservation.expiresAt}}));
  });}
  cancel(c:CheckoutContext,id:string,version:number){return this.scope(c,async(tx,customerId)=>{
    const row=await this.load(tx,c,customerId,id);if(row.status==='CANCELLED')return domain(row);await assertCheckoutPaymentMutable(tx,id);checkoutVersion(domain(row),version);await this.release(tx,row,customerId);
    await this.audit(tx,customerId,'CHECKOUT_CANCELLED',id);
    return domain(await tx.checkout.update({where:{id},data:{status:'CANCELLED',version:{increment:1},reservationId:null}}));
  });}

  orders(c:CheckoutContext,input:OrderQuery&{limit:number;offset:number}){return this.scope(c,async(tx,customerId)=>(await tx.order.findMany({where:{storeId:c.storeId,customerId,...(input.status?{status:input.status}:{}),...(input.query?{number:{contains:input.query,mode:'insensitive'}}:{})},orderBy:[{createdAt:'desc'},{id:'asc'}],take:input.limit+1,skip:input.offset,include:orderInclude})).map(orderDomain),'account');}
  order(c:CheckoutContext,id:string){return this.scope(c,async(tx,customerId)=>{const row=await tx.order.findFirst({where:{id,storeId:c.storeId,customerId},include:orderInclude});if(!row)throw new DomainError('NOT_FOUND','Order not found.');return orderDomain(row);},'account');}
  placeCod(c:CheckoutContext,id:string,version:number,key:string){return this.scope(c,async(tx,customerId)=>{await assertCheckoutPaymentMutable(tx,id);return placeCheckout(tx,c.storeId,customerId,id,version,key);});}
}
