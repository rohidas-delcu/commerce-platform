import {isDeepStrictEqual} from 'node:util';
import {allocateMinor,type OrderQuery} from '../../orders/domain/orders.js';
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
  private scope<T>(c:CheckoutContext,work:(tx:Prisma.TransactionClient,customerId:string)=>Promise<T>){return withStorefrontSession(this.db,c.storeId,c.principal,true,(tx,id)=>{if(!id)throw new IdentityError(401,'Authentication required.');return work(tx,id);});}
  private async load(tx:Prisma.TransactionClient,c:CheckoutContext,customerId:string,id:string){
    await tx.$queryRaw`SELECT id FROM "Checkout" WHERE id=${id}::uuid AND "storeId"=${c.storeId}::uuid AND "customerId"=${customerId}::uuid FOR UPDATE`;
    const row=await tx.checkout.findFirst({where:{id,storeId:c.storeId,customerId}});if(!row)throw new DomainError('NOT_FOUND','Checkout not found.');return row;
  }
  private async release(tx:Prisma.TransactionClient,row:Row,actor:string){if(row.reservationId)await new InventoryService(new PrismaCommerceRepository(tx).inventory).transition(row.storeId,row.reservationId,'release',actor);await tx.couponHold.updateMany({where:{checkoutId:row.id,storeId:row.storeId,checkoutVersion:row.version,status:'HELD'},data:{status:row.expiresAt<=new Date()?'EXPIRED':'RELEASED',closedAt:new Date()}});}
  private async expire(tx:Prisma.TransactionClient,row:Row,actor:string){
    if(['DRAFT','READY'].includes(row.status)&&row.expiresAt<=new Date()){
      await this.release(tx,row,actor);await this.audit(tx,actor,'CHECKOUT_EXPIRED',row.id);return tx.checkout.update({where:{id:row.id},data:{status:'EXPIRED',version:{increment:1},reservationId:null}});
    }return row;
  }
  private async audit(tx:Prisma.TransactionClient,actor:string,action:string,id:string){await tx.identityAudit.create({data:{identityId:actor,action:action+':'+id}});}
  start(c:CheckoutContext,cartId:string,cartVersion:number,key:string){return this.scope(c,async(tx,customerId)=>{
    const digest=createHash('sha256').update(JSON.stringify({cartId,cartVersion})).digest('hex');
    const prior=await tx.checkout.findUnique({where:{storeId_customerId_key:{storeId:c.storeId,customerId,key}}});
    if(prior){if(prior.digest!==digest)throw new DomainError('CONFLICT','Checkout key already used for different input.');return this.view(tx,await this.expire(tx,prior,customerId));}
    const cart=await tx.cart.findFirst({where:{id:cartId,storeId:c.storeId,customerId,status:'ACTIVE',expiresAt:{gt:new Date()}},include:{lines:true}});
    if(!cart)throw new DomainError('NOT_FOUND','Active customer cart not found.');if(!cart.lines.length||cart.version!==cartVersion)throw new DomainError('CONFLICT','Cart is empty or changed.');
    const active=await tx.checkout.findFirst({where:{storeId:c.storeId,cartId,status:{in:['DRAFT','READY']}}});
    if(active&&['DRAFT','READY'].includes((await this.expire(tx,active,customerId)).status))throw new DomainError('CONFLICT','An active checkout already exists for this cart. Resume it.');
    const profile=await tx.identity.findUniqueOrThrow({where:{id:customerId},select:{name:true,email:true}});
    const saved=await tx.checkout.create({data:{storeId:c.storeId,customerId,cartId,cartVersion,key,digest,...checkoutContact(profile.email,profile.name),expiresAt:new Date(Date.now()+86400000)}});await this.audit(tx,customerId,'CHECKOUT_STARTED',saved.id);return domain(saved);
  });}
  private async view(tx:Prisma.TransactionClient,row:Row){const order=await tx.order.findFirst({where:{checkoutId:row.id,storeId:row.storeId,customerId:row.customerId},select:{id:true}});return{...domain(row),orderId:order?.id??null};}
  get(c:CheckoutContext,id:string){return this.scope(c,async(tx,customerId)=>this.view(tx,await this.expire(tx,await this.load(tx,c,customerId,id),customerId)));}
  configure(c:CheckoutContext,id:string,input:CheckoutChanges){return this.scope(c,async(tx,customerId)=>{
    const row=await this.load(tx,c,customerId,id);checkoutVersion(domain(row),input.expectedVersion);
    const contact=checkoutContact(input.contactEmail??row.contactEmail,input.contactName??row.contactName);
    const address=input.shippingAddress?customerAddress(input.shippingAddress):null;
    await this.release(tx,row,customerId);
    await this.audit(tx,customerId,'CHECKOUT_CONFIGURED',id);
    return domain(await tx.checkout.update({where:{id},data:{...contact,...(address?{shippingAddress:{...address}}:{}),...(input.shippingMethodId!==undefined?{shippingMethodId:input.shippingMethodId}:{}),status:'DRAFT',version:{increment:1},snapshot:Prisma.DbNull,reservationId:null,expiresAt:new Date(row.createdAt.getTime()+86400000)}}));
  });}
  reserve(c:CheckoutContext,id:string,version:number){return this.scope(c,async(tx,customerId)=>{
    const row=await this.load(tx,c,customerId,id),existing=domain(row);
    if(row.status==='READY'&&row.expiresAt>new Date()&&existing.snapshot?.baseVersion===version)return existing;
    checkoutVersion(existing,version);
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
    const row=await this.load(tx,c,customerId,id);if(row.status==='CANCELLED')return domain(row);checkoutVersion(domain(row),version);await this.release(tx,row,customerId);
    await this.audit(tx,customerId,'CHECKOUT_CANCELLED',id);
    return domain(await tx.checkout.update({where:{id},data:{status:'CANCELLED',version:{increment:1},reservationId:null}}));
  });}

  orders(c:CheckoutContext,input:OrderQuery&{limit:number;offset:number}){return this.scope(c,async(tx,customerId)=>(await tx.order.findMany({where:{storeId:c.storeId,customerId,...(input.status?{status:input.status}:{}),...(input.query?{number:{contains:input.query,mode:'insensitive'}}:{})},orderBy:[{createdAt:'desc'},{id:'asc'}],take:input.limit+1,skip:input.offset,include:orderInclude})).map(orderDomain));}
  order(c:CheckoutContext,id:string){return this.scope(c,async(tx,customerId)=>{const row=await tx.order.findFirst({where:{id,storeId:c.storeId,customerId},include:orderInclude});if(!row)throw new DomainError('NOT_FOUND','Order not found.');return orderDomain(row);});}
  placeCod(c:CheckoutContext,id:string,version:number,key:string){return this.scope(c,async(tx,customerId)=>{
    const digest=createHash('sha256').update(JSON.stringify({checkoutId:id,version,paymentMethod:'COD'})).digest('hex');
    const previous=await tx.order.findUnique({where:{storeId_customerId_placementKey:{storeId:c.storeId,customerId,placementKey:key}},include:orderInclude});
    if(previous){if(previous.placementDigest!==digest)throw new DomainError('CONFLICT','Order key already used for different input.');return orderDomain(previous);}
    const row=await this.load(tx,c,customerId,id);checkoutVersion(domain(row),version);
    if(row.status!=='READY'||!row.reservationId||!row.snapshot||!row.shippingAddress||!row.shippingMethodId)throw new DomainError('CONFLICT','A ready reserved checkout is required.');
    const snapshot=domain(row).snapshot!;
    const repo=new PrismaCommerceRepository(tx),policy=await repo.pricing.policy(c.storeId);assertPricingReady(policy);
    if(!policy?.payments.cod)throw new DomainError('CONFLICT','Cash on delivery is not available.');
    const cart=await tx.cart.findFirst({where:{id:row.cartId,storeId:c.storeId,customerId,status:'ACTIVE',expiresAt:{gt:new Date()}},include:{lines:{orderBy:{variantId:'asc'}}}});
    const currency=(await tx.store.findUniqueOrThrow({where:{id:c.storeId},select:{currencyCode:true}})).currencyCode;
    if(!cart||currency!==snapshot.currencyCode||cart.version!==snapshot.cartVersion||policy.version!==snapshot.totals.policyVersion)throw new DomainError('CONFLICT','Cart or policy changed. Requote checkout.');
    const coupon=cart.couponId?await repo.pricing.couponRule(c.storeId,cart.couponId,customerId,cart.id):null;
    if((cart.couponId??null)!==(snapshot.couponId??null)||(coupon?.version??null)!==(snapshot.couponVersion??null))throw new DomainError('CONFLICT','Coupon changed. Requote checkout.');
    const products=await repo.productsForVariants(c.storeId,cart.lines.map(line=>line.variantId));
    const items:CheckoutItem[]=cart.lines.map(line=>{
      const product=products.find(p=>p.variants.some(v=>v.id===line.variantId)),variant=product?.variants.find(v=>v.id===line.variantId);
      if(!product||product.status!=='ACTIVE'||!variant||variant.active===false)throw new DomainError('CONFLICT','Product unavailable. Requote checkout.');
      const unitPriceMinor=variant.priceMinor??product.priceMinor;
      return{productId:product.id,variantId:variant.id,productName:product.name,variantName:variant.name,sku:variant.sku,quantity:line.quantity,unitPriceMinor,subtotalMinor:(BigInt(unitPriceMinor)*BigInt(line.quantity)).toString()};
    });
    if(!isDeepStrictEqual(items,snapshot.items))throw new DomainError('CONFLICT','Catalog changed. Requote checkout.');
    const address=customerAddress(row.shippingAddress as unknown as AddressInput),totals=calculateQuote(policy,{discount:coupon??undefined,subtotalMinor:items.reduce((sum,item)=>sum+BigInt(item.subtotalMinor),0n).toString(),countryCode:address.countryCode,shippingMethodId:row.shippingMethodId,customerId,now:new Date()});
    if(!isDeepStrictEqual(totals,snapshot.totals))throw new DomainError('CONFLICT','Quote changed. Requote checkout.');
    const reservation=await repo.inventory.find(c.storeId,row.reservationId);
    if(!reservation||reservation.status!=='ACTIVE'||!isDeepStrictEqual(reservation.lines,items.map(item=>({variantId:item.variantId,quantity:item.quantity}))))throw new DomainError('CONFLICT','Inventory hold unavailable.');
    await new InventoryService(repo.inventory).transition(c.storeId,row.reservationId,'commit',customerId);
    let couponHold: {id:string;restoreOnCancellation:boolean}|null=null;
    if(coupon){
      if(!snapshot.couponHoldId)throw new DomainError('CONFLICT','Coupon lease missing. Requote checkout.');
      const[clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;assertCouponEligible(coupon,customerId,clock.now);
      const held=await tx.couponHold.findFirst({where:{id:snapshot.couponHoldId,storeId:c.storeId,customerId,checkoutId:id,couponId:coupon.id,couponVersion:coupon.version,status:'HELD',expiresAt:{gt:clock.now}}});
      if(!held)throw new DomainError('CONFLICT','Coupon lease expired or unavailable.');
      const consumed=await tx.couponHold.updateMany({where:{id:held.id,status:'HELD',expiresAt:{gt:clock.now}},data:{status:'CONSUMED',closedAt:clock.now}});if(consumed.count!==1)throw new DomainError('CONFLICT','Coupon lease changed.');couponHold=held;
    }
    const counter=await tx.storeOrderCounter.upsert({where:{storeId:c.storeId},create:{storeId:c.storeId,value:1n},update:{value:{increment:1}}});
    const number='DLC-'+counter.value.toString().padStart(8,'0');
    const discounts=allocateMinor(BigInt(totals.discountMinor),items.map(item=>BigInt(item.subtotalMinor))),taxWeights=items.map((item,index)=>BigInt(item.subtotalMinor)-discounts[index]);
    taxWeights.push(policy.tax.shippingTaxable?BigInt(totals.shippingMinor):0n);const taxes=allocateMinor(BigInt(totals.taxMinor),taxWeights),shippingTaxMinor=taxes[taxes.length-1];
    const order=await tx.order.create({data:{storeId:c.storeId,customerId,checkoutId:id,placementKey:key,placementDigest:digest,number,paymentStatus:BigInt(totals.totalMinor)===0n?'NOT_REQUIRED':'DUE',contactEmail:row.contactEmail,contactName:row.contactName,shippingAddress:{...address},shippingMethodName:snapshot.shippingMethodName,currencyCode:snapshot.currencyCode,taxSnapshot:{...totals,shippingTaxable:policy.tax.shippingTaxable,shippingTaxMinor:shippingTaxMinor.toString()},subtotalMinor:BigInt(totals.subtotalMinor),discountMinor:BigInt(totals.discountMinor),shippingMinor:BigInt(totals.shippingMinor),taxMinor:BigInt(totals.taxMinor),shippingTaxMinor,taxInclusive:totals.taxInclusive,totalMinor:BigInt(totals.totalMinor),amountDueMinor:BigInt(totals.totalMinor),items:{create:items.map((item,index)=>({...item,unitPriceMinor:BigInt(item.unitPriceMinor),subtotalMinor:BigInt(item.subtotalMinor),discountMinor:discounts[index],taxMinor:taxes[index]}))},events:{create:{kind:'PLACED',actorId:customerId}}},include:orderInclude});
    if(coupon&&couponHold)await tx.couponRedemption.create({data:{orderId:order.id,storeId:c.storeId,customerId,couponId:coupon.id,couponVersion:coupon.version,holdId:couponHold.id,discountMinor:BigInt(totals.discountMinor),restoreOnCancellation:couponHold.restoreOnCancellation}});
    await tx.orderNotification.create({data:{orderId:order.id,storeId:c.storeId,kind:'ORDER_CONFIRMATION',key:order.id+':ORDER_CONFIRMATION'}});
    await tx.checkout.update({where:{id},data:{status:'COMPLETED',version:{increment:1}}});
    await tx.cart.update({where:{id:cart.id},data:{status:'CHECKED_OUT',version:{increment:1}}});
    await this.audit(tx,customerId,'ORDER_PLACED',order.id);return orderDomain(order);
  });}
}
