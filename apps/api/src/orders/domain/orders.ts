import {DomainError} from '../../domain/commerce.js';
import {customerAddress,type AddressInput} from '../../customer/domain/customer.js';
export type OrderStatus='PLACED'|'COMPLETED'|'CANCELLED';
export type PaymentStatus='DUE'|'PAID'|'VOID';
export type FulfillmentStatus='UNFULFILLED'|'READY'|'DISPATCHED'|'DELIVERED'|'CANCELLED';
export interface OrderItem {id:string;productId:string;variantId:string;productName:string;variantName:string;sku:string;quantity:number;unitPriceMinor:string;subtotalMinor:string;discountMinor:string;taxMinor:string;}
export interface OrderEvent {id:string;kind:string;actorId:string;createdAt:Date;}
export interface Order {
  id:string;number:string;checkoutId:string;status:OrderStatus;paymentStatus:PaymentStatus;fulfillmentStatus:FulfillmentStatus;paymentMethod:'COD';version:number;createdAt:Date;
  contactEmail:string;contactName:string;shippingAddress:AddressInput;shippingMethodName:string;currencyCode:string;
  subtotalMinor:string;discountMinor:string;shippingMinor:string;taxMinor:string;shippingTaxMinor:string;taxInclusive:boolean;totalMinor:string;amountDueMinor:string;paidMinor:string;items:OrderItem[];events:OrderEvent[];
}
export interface OrderQuery {limit?:number;offset?:number;status?:OrderStatus;query?:string;}
export function orderQuery(input:OrderQuery){const limit=input.limit??50,offset=input.offset??0;if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>10000||(input.status&&!['PLACED','COMPLETED','CANCELLED'].includes(input.status))||(input.query!==undefined&&(typeof input.query!=='string'||input.query.length>100)))throw new DomainError('INVALID','Invalid order query.');return{...input,limit,offset};}
export function orderProjection(order:Order,merchant=false){
  return{id:order.id,number:order.number,checkoutId:order.checkoutId,status:order.status,paymentStatus:order.paymentStatus,fulfillmentStatus:order.fulfillmentStatus,paymentMethod:order.paymentMethod,version:order.version,createdAt:order.createdAt,
    contactEmail:order.contactEmail,contactName:order.contactName,shippingAddress:customerAddress(order.shippingAddress),shippingMethodName:order.shippingMethodName,currencyCode:order.currencyCode,
    subtotalMinor:order.subtotalMinor,discountMinor:order.discountMinor,shippingMinor:order.shippingMinor,taxMinor:order.taxMinor,shippingTaxMinor:order.shippingTaxMinor,taxInclusive:order.taxInclusive,totalMinor:order.totalMinor,amountDueMinor:order.amountDueMinor,paidMinor:order.paidMinor,
    items:order.items.map(item=>({id:item.id,productId:item.productId,variantId:item.variantId,productName:item.productName,variantName:item.variantName,quantity:item.quantity,unitPriceMinor:item.unitPriceMinor,subtotalMinor:item.subtotalMinor,discountMinor:item.discountMinor,taxMinor:item.taxMinor,...(merchant?{sku:item.sku}:{})})),
    events:order.events.map(event=>({id:event.id,kind:event.kind,createdAt:event.createdAt,...(merchant?{actorId:event.actorId}:{})}))};
}
/** Largest remainder allocation; tie order is stable and all integer units are conserved. */
export function allocateMinor(total:bigint,weights:bigint[]){
  if(total<0n||weights.some(w=>w<0n))throw new DomainError('INVALID','Invalid allocation.');
  const sum=weights.reduce((a,b)=>a+b,0n);if(sum===0n){if(total!==0n)throw new DomainError('INVALID','Cannot allocate to zero weight.');return weights.map(()=>0n);}
  const shares=weights.map(weight=>total*weight/sum),remainders=weights.map((weight,index)=>({index,value:total*weight%sum})).sort((a,b)=>a.value>b.value?-1:a.value<b.value?1:a.index-b.index);
  let remaining=total-shares.reduce((a,b)=>a+b,0n);for(const entry of remainders){if(!remaining)break;shares[entry.index]+=1n;remaining--;}
  return shares;
}
