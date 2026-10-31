import type {Coupon,CouponRule,CouponQuery} from '../domain/coupons.js';
import type {PricingPolicy} from '../domain/pricing.js';
export interface PricingRepositoryPort {
  coupon(storeId:string,id:string):Promise<Coupon|null>;
  couponByCode(storeId:string,code:string):Promise<Coupon|null>;
  coupons(storeId:string,query:CouponQuery):Promise<Coupon[]>;
  createCoupon(coupon:Coupon,actor:string):Promise<Coupon>;
  saveCoupon(coupon:Coupon,actor:string):Promise<Coupon>;
  couponRule(storeId:string,id:string,customerId:string|null,excludeCartId?:string):Promise<CouponRule|null>;
  policy(storeId:string):Promise<PricingPolicy|null>;
  savePolicy(storeId:string,policy:PricingPolicy,actor:string):Promise<PricingPolicy>;
}
