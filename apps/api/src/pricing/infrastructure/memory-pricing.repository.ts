import type {Coupon,CouponQuery} from '../domain/coupons.js';
import {DomainError} from '../../domain/commerce.js';
import {pricingPolicy,type PricingPolicy} from '../domain/pricing.js';
import type {PricingRepositoryPort} from '../application/pricing.port.js';
export class MemoryPricingRepository implements PricingRepositoryPort {
  private discounts=new Map<string,Coupon>();
  private policies=new Map<string,PricingPolicy>();
  async policy(id:string){return structuredClone(this.policies.get(id)??null);}
  async savePolicy(id:string,input:PricingPolicy,_actor:string){const policy=pricingPolicy(input),current=this.policies.get(id);if((current?.version??0)!==policy.version)throw new DomainError('CONFLICT','Pricing configuration changed.');const saved={...policy,version:policy.version+1};this.policies.set(id,structuredClone(saved));return structuredClone(saved);}

  async coupon(storeId:string,id:string){const row=this.discounts.get(id);return structuredClone(row?.storeId===storeId?row:null);}
  async couponByCode(storeId:string,code:string){return structuredClone([...this.discounts.values()].find(c=>c.storeId===storeId&&c.code===code)??null);}
  async coupons(storeId:string,query:CouponQuery){return structuredClone([...this.discounts.values()].filter(c=>c.storeId===storeId&&(!query.query||c.code.includes(query.query.toUpperCase()))).sort((a,b)=>a.id.localeCompare(b.id)).slice(query.offset,query.offset+query.limit+1));}
  async createCoupon(coupon:Coupon,_actor:string){if([...this.discounts.values()].some(c=>c.storeId===coupon.storeId&&c.code===coupon.code))throw new DomainError('CONFLICT','Coupon code exists.');this.discounts.set(coupon.id,structuredClone(coupon));return structuredClone(coupon);}
  async saveCoupon(coupon:Coupon,_actor:string){const prior=this.discounts.get(coupon.id);if(!prior||prior.storeId!==coupon.storeId||prior.version!==coupon.version)throw new DomainError('CONFLICT','Coupon changed.');const saved={...coupon,version:coupon.version+1};this.discounts.set(coupon.id,structuredClone(saved));return structuredClone(saved);}
  async couponRule(storeId:string,id:string,_customerId:string|null){const c=await this.coupon(storeId,id);return c?{...c,used:0,customerUses:0,consumedUses:0,heldUses:0}:null;}
}
