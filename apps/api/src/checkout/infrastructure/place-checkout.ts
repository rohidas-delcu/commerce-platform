import {databaseTime} from './checkout-lifecycle.js';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import type {Prisma} from '../../generated/prisma/client.js';
import {PrismaCommerceRepository} from '../../infrastructure/prisma-commerce.repository.js';
import {InventoryService} from '../../inventory/application/inventory.service.js';
import {DomainError} from '../../domain/commerce.js';
import {assertPricingReady,calculateQuote,assertCouponEligible} from '../../pricing/domain/pricing.js';
import {customerAddress,type AddressInput} from '../../customer/domain/customer.js';
import {checkoutVersion,type CheckoutSnapshot,type CheckoutItem} from '../domain/checkout.js';
import {allocateMinor} from '../../orders/domain/orders.js';
import {orderDomain,orderInclude} from '../../orders/infrastructure/prisma-orders.repository.js';
export interface VerifiedCheckoutPayment {method:'SIMULATOR'|'RAZORPAY';amountMinor:string;currencyCode:string;}
// Caller owns customer identity → account → store locks, and a persisted verified receipt.
export async function placeCheckout(tx:Prisma.TransactionClient,storeId:string,customerId:string,id:string,version:number,key:string,proof?:VerifiedCheckoutPayment){
    const digest=createHash('sha256').update(JSON.stringify({checkoutId:id,version,paymentMethod:proof?.method??'COD'})).digest('hex');
    const previous=await tx.order.findUnique({where:{storeId_customerId_placementKey:{storeId:storeId,customerId,placementKey:key}},include:orderInclude});
    if(previous){if(previous.placementDigest!==digest)throw new DomainError('CONFLICT','Order key already used for different input.');return orderDomain(previous);}
    const{row,snapshot,repo,policy,cart,totals,items,coupon,reservation,address,billingAddress,billingAddressSource}=await validateCheckoutPlacement(tx,storeId,customerId,id,version,proof);
    await new InventoryService(repo.inventory).transition(storeId,reservation.id,'commit',customerId);
    let couponHold: {id:string;restoreOnCancellation:boolean}|null=null;
    if(coupon){
      if(!snapshot.couponHoldId)throw new DomainError('CONFLICT','Coupon lease missing. Requote checkout.');
      const[clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;assertCouponEligible(coupon,customerId,clock.now);
      const held=await tx.couponHold.findFirst({where:{id:snapshot.couponHoldId,storeId:storeId,customerId,checkoutId:id,couponId:coupon.id,couponVersion:coupon.version,status:'HELD',expiresAt:{gt:clock.now}}});
      if(!held)throw new DomainError('CONFLICT','Coupon lease expired or unavailable.');
      const consumed=await tx.couponHold.updateMany({where:{id:held.id,status:'HELD',expiresAt:{gt:clock.now}},data:{status:'CONSUMED',closedAt:clock.now}});if(consumed.count!==1)throw new DomainError('CONFLICT','Coupon lease changed.');couponHold=held;
    }
    const counter=await tx.storeOrderCounter.upsert({where:{storeId:storeId},create:{storeId:storeId,value:1n},update:{value:{increment:1}}});
    const number='DLC-'+counter.value.toString().padStart(8,'0');
    const discounts=allocateMinor(BigInt(totals.discountMinor),items.map(item=>BigInt(item.subtotalMinor))),taxWeights=items.map((item,index)=>BigInt(item.subtotalMinor)-discounts[index]);
    taxWeights.push(policy.tax.shippingTaxable?BigInt(totals.shippingMinor):0n);const taxes=allocateMinor(BigInt(totals.taxMinor),taxWeights),shippingTaxMinor=taxes[taxes.length-1];
    const order=await tx.order.create({data:{storeId:storeId,customerId,checkoutId:id,placementKey:key,placementDigest:digest,number,paymentMethod:proof?.method??'COD',paymentStatus:proof?'PAID':BigInt(totals.totalMinor)===0n?'NOT_REQUIRED':'DUE',paidMinor:proof?BigInt(totals.totalMinor):0n,contactEmail:row.contactEmail,contactName:row.contactName,shippingAddress:{...address},billingAddress:{...billingAddress},billingAddressSource,shippingMethodName:snapshot.shippingMethodName,currencyCode:snapshot.currencyCode,taxSnapshot:{...totals,shippingTaxable:policy.tax.shippingTaxable,shippingTaxMinor:shippingTaxMinor.toString()},subtotalMinor:BigInt(totals.subtotalMinor),discountMinor:BigInt(totals.discountMinor),shippingMinor:BigInt(totals.shippingMinor),taxMinor:BigInt(totals.taxMinor),shippingTaxMinor,taxInclusive:totals.taxInclusive,totalMinor:BigInt(totals.totalMinor),amountDueMinor:proof?0n:BigInt(totals.totalMinor),items:{create:items.map((item,index)=>({...item,unitPriceMinor:BigInt(item.unitPriceMinor),subtotalMinor:BigInt(item.subtotalMinor),discountMinor:discounts[index],taxMinor:taxes[index]}))},events:{create:{kind:'PLACED',actorId:customerId}}},include:orderInclude});
    if(coupon&&couponHold)await tx.couponRedemption.create({data:{orderId:order.id,storeId:storeId,customerId,couponId:coupon.id,couponVersion:coupon.version,holdId:couponHold.id,discountMinor:BigInt(totals.discountMinor),restoreOnCancellation:couponHold.restoreOnCancellation}});
    await tx.orderNotification.create({data:{orderId:order.id,storeId:storeId,kind:'ORDER_CONFIRMATION',key:order.id+':ORDER_CONFIRMATION'}});
    await tx.checkout.update({where:{id},data:{status:'COMPLETED',version:{increment:1}}});
    await tx.cart.update({where:{id:cart.id},data:{status:'CHECKED_OUT',version:{increment:1}}});
    if(proof)await tx.orderNotification.create({data:{orderId:order.id,storeId,kind:'PAYMENT_CONFIRMATION',key:order.id+':PAYMENT_CONFIRMATION'}});
    await tx.identityAudit.create({data:{identityId:customerId,action:'ORDER_PLACED:'+order.id}});return orderDomain(order);

}

export async function validateCheckoutPlacement(tx:Prisma.TransactionClient,storeId:string,customerId:string,id:string,version:number,proof?:VerifiedCheckoutPayment){
    await tx.$queryRaw`SELECT id FROM "Checkout" WHERE id=${id}::uuid AND "storeId"=${storeId}::uuid AND "customerId"=${customerId}::uuid FOR UPDATE`;
    const row=await tx.checkout.findFirst({where:{id,storeId,customerId}});if(!row)throw new DomainError('NOT_FOUND','Checkout not found.');checkoutVersion({status:row.status as 'READY',version:row.version,expiresAt:row.expiresAt},version);
    if(row.status!=='READY'||!row.reservationId||!row.snapshot||!row.shippingAddress||!row.shippingMethodId)throw new DomainError('CONFLICT','A ready reserved checkout is required.');
    const snapshot=row.snapshot as unknown as CheckoutSnapshot;
    const repo=new PrismaCommerceRepository(tx),policy=await repo.pricing.policy(storeId);assertPricingReady(policy);
    if(!policy||(!proof&&!policy.payments.cod)||(proof&&(proof.method!=='SIMULATOR'||!policy.payments.simulator)))throw new DomainError('CONFLICT','Selected payment method is unavailable.');
    const cart=await tx.cart.findFirst({where:{id:row.cartId,storeId:storeId,customerId,status:'ACTIVE',expiresAt:{gt:new Date()}},include:{lines:{orderBy:{variantId:'asc'}}}});
    const currency=(await tx.store.findUniqueOrThrow({where:{id:storeId},select:{currencyCode:true}})).currencyCode;
    if(!cart||currency!==snapshot.currencyCode||cart.version!==snapshot.cartVersion||policy.version!==snapshot.totals.policyVersion)throw new DomainError('CONFLICT','Cart or policy changed. Requote checkout.');
    const coupon=cart.couponId?await repo.pricing.couponRule(storeId,cart.couponId,customerId,cart.id):null;
    if((cart.couponId??null)!==(snapshot.couponId??null)||(coupon?.version??null)!==(snapshot.couponVersion??null))throw new DomainError('CONFLICT','Coupon changed. Requote checkout.');
    const products=await repo.productsForVariants(storeId,cart.lines.map(line=>line.variantId));
    const items:CheckoutItem[]=cart.lines.map(line=>{
      const product=products.find(p=>p.variants.some(v=>v.id===line.variantId)),variant=product?.variants.find(v=>v.id===line.variantId);
      if(!product||product.status!=='ACTIVE'||!variant||variant.active===false)throw new DomainError('CONFLICT','Product unavailable. Requote checkout.');
      const unitPriceMinor=variant.priceMinor??product.priceMinor;
      return{productId:product.id,variantId:variant.id,productName:product.name,variantName:variant.name,sku:variant.sku,quantity:line.quantity,unitPriceMinor,subtotalMinor:(BigInt(unitPriceMinor)*BigInt(line.quantity)).toString()};
    });
    if(!isDeepStrictEqual(items,snapshot.items))throw new DomainError('CONFLICT','Catalog changed. Requote checkout.');
    const address=customerAddress(row.shippingAddress as unknown as AddressInput),totals=calculateQuote(policy,{discount:coupon??undefined,subtotalMinor:items.reduce((sum,item)=>sum+BigInt(item.subtotalMinor),0n).toString(),countryCode:address.countryCode,shippingMethodId:row.shippingMethodId,customerId,now:new Date()});
    if(!isDeepStrictEqual(totals,snapshot.totals))throw new DomainError('CONFLICT','Quote changed. Requote checkout.');
    if(proof&&(proof.amountMinor!==totals.totalMinor||proof.currencyCode!==snapshot.currencyCode||BigInt(proof.amountMinor)<=0n))throw new DomainError('CONFLICT','Verified payment does not match the quote.');
    const reservation=await repo.inventory.find(storeId,row.reservationId);
    if(!reservation||reservation.status!=='ACTIVE'||reservation.expiresAt<=await databaseTime(tx)||!isDeepStrictEqual(reservation.lines,items.map(item=>({variantId:item.variantId,quantity:item.quantity}))))throw new DomainError('CONFLICT','Inventory hold unavailable.');
    const billingAddress=row.billingAddress?customerAddress(row.billingAddress as unknown as AddressInput):address,billingAddressSource=row.billingAddress?'CUSTOMER_PROVIDED':'SHIPPING_DEFAULT';
    return{row,snapshot,repo,policy,cart,totals,items,coupon,reservation,address,billingAddress,billingAddressSource};
}
