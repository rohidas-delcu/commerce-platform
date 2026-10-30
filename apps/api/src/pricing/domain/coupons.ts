import {DomainError} from '../../domain/commerce.js';
import {minorAmount,type DiscountRule} from './pricing.js';
export interface Coupon {
  id:string;storeId:string;version:number;code:string;kind:'PERCENTAGE'|'FIXED';value:string;
  active:boolean;startsAt:Date|null;expiresAt:Date|null;maxUses:number|null;perCustomerLimit:number|null;restoreOnCancellation:boolean;
}
export interface CouponRule extends DiscountRule {id:string;version:number;restoreOnCancellation:boolean;consumedUses:number;heldUses:number;}
export function couponCode(input:string){const code=input.trim().toUpperCase();if(!/^[A-Z0-9_-]{3,40}$/.test(code))throw new DomainError('INVALID','Coupon code requires 3–40 letters, numbers, underscores or hyphens.');return code;}
export function couponMetadata(input:Omit<Coupon,'id'|'storeId'|'version'>){
  const code=couponCode(input.code);
  if(!['PERCENTAGE','FIXED'].includes(input.kind)||typeof input.active!=='boolean'||typeof input.restoreOnCancellation!=='boolean')throw new DomainError('INVALID','Invalid coupon configuration.');
  const value=minorAmount(input.value);if(value<1n||(input.kind==='PERCENTAGE'&&value>10000n))throw new DomainError('INVALID','Coupon value must be positive; percentage is 1–10000 basis points.');
  for(const limit of [input.maxUses,input.perCustomerLimit])if(limit!==null&&(!Number.isSafeInteger(limit)||limit<1||limit>1000000000))throw new DomainError('INVALID','Coupon usage limits must be positive bounded integers or null.');
  for(const date of [input.startsAt,input.expiresAt])if(date!==null&&(!(date instanceof Date)||!Number.isFinite(date.getTime())))throw new DomainError('INVALID','Invalid coupon validity date.');
  if(input.startsAt&&input.expiresAt&&input.expiresAt<=input.startsAt)throw new DomainError('INVALID','Coupon expiry must follow its start.');
  return{code,kind:input.kind,value:value.toString(),active:input.active,restoreOnCancellation:input.restoreOnCancellation,startsAt:input.startsAt,expiresAt:input.expiresAt,maxUses:input.maxUses,perCustomerLimit:input.perCustomerLimit};
}
export interface CouponQuery {limit:number;offset:number;query?:string;}
export function couponQuery(input:Partial<CouponQuery>){const limit=input.limit??50,offset=input.offset??0;if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>10000||(input.query!==undefined&&(typeof input.query!=='string'||input.query.length>40)))throw new DomainError('INVALID','Invalid coupon query.');return{limit,offset,query:input.query};}
export interface CouponInput {code:string;kind:'PERCENTAGE'|'FIXED';value:string;active?:boolean;startsAt?:string|null;expiresAt?:string|null;maxUses?:number|null;perCustomerLimit?:number|null;restoreOnCancellation?:boolean;}
export type CouponChanges=Partial<Omit<CouponInput,'code'>>&{expectedVersion:number};
