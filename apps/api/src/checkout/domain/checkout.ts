import {DomainError} from '../../domain/commerce.js';
import {emailAddress} from '../../identity/domain/identity.js';
import {customerAddress,type AddressInput} from '../../customer/domain/customer.js';
import type {calculateQuote} from '../../pricing/domain/pricing.js';
export type CheckoutStatus='DRAFT'|'READY'|'COMPLETED'|'CANCELLED'|'EXPIRED';
export type CheckoutItem={productId:string;variantId:string;productName:string;variantName:string;sku:string;quantity:number;unitPriceMinor:string;subtotalMinor:string;};
export type CheckoutSnapshot={baseVersion:number;cartVersion:number;currencyCode:string;totals:ReturnType<typeof calculateQuote>;shippingMethodName:string;items:CheckoutItem[];};
export interface Checkout {
  orderId?:string|null;
  id:string;cartId:string;status:CheckoutStatus;version:number;expiresAt:Date;
  contactEmail:string;contactName:string;shippingMethodId:string|null;
  shippingAddress:AddressInput|null;snapshot:CheckoutSnapshot|null;
}
export interface CheckoutChanges {expectedVersion:number;contactEmail?:string;contactName?:string;shippingMethodId?:string;shippingAddress?:AddressInput;}
export function checkoutContact(email:string,name:string){
  let normalized:string;try{normalized=emailAddress(email);}catch{throw new DomainError('INVALID','Invalid contact email.');}
  if(typeof name!=='string'||!name.trim()||name.trim().length>100||/[\x00-\x1f]/.test(name))throw new DomainError('INVALID','Contact name required.');
  return{contactEmail:normalized,contactName:name.trim()};
}
export function checkoutVersion(checkout:Pick<Checkout,'status'|'version'|'expiresAt'>,version:number){
  if(!['DRAFT','READY'].includes(checkout.status)||checkout.expiresAt<=new Date())throw new DomainError('CONFLICT','Checkout is closed or expired.');
  if(!Number.isSafeInteger(version)||version!==checkout.version)throw new DomainError('CONFLICT','Checkout changed. Refresh before retrying.');
}
export function checkoutProjection(checkout:Checkout){
  const snapshot=checkout.snapshot,totals=snapshot?.totals;
  return{id:checkout.id,orderId:checkout.orderId??null,cartId:checkout.cartId,status:checkout.status,version:checkout.version,expiresAt:checkout.expiresAt,contactEmail:checkout.contactEmail,contactName:checkout.contactName,shippingMethodId:checkout.shippingMethodId,shippingAddress:checkout.shippingAddress?customerAddress(checkout.shippingAddress):null,snapshot:snapshot&&totals?{
    cartVersion:snapshot.cartVersion,currencyCode:snapshot.currencyCode,shippingMethodName:snapshot.shippingMethodName,
    totals:{subtotalMinor:totals.subtotalMinor,discountMinor:totals.discountMinor,shippingMinor:totals.shippingMinor,taxMinor:totals.taxMinor,totalMinor:totals.totalMinor,taxInclusive:totals.taxInclusive,taxBasisPoints:totals.taxBasisPoints,shippingMethodId:totals.shippingMethodId,policyVersion:totals.policyVersion,discountCode:totals.discountCode},
    items:snapshot.items.map(item=>({productId:item.productId,variantId:item.variantId,productName:item.productName,variantName:item.variantName,quantity:item.quantity,unitPriceMinor:item.unitPriceMinor,subtotalMinor:item.subtotalMinor}))
  }:null};
}
