import type {PricingPolicy} from '../domain/pricing.js';
export interface PricingRepositoryPort {
  policy(storeId:string):Promise<PricingPolicy|null>;
  savePolicy(storeId:string,policy:PricingPolicy,actor:string):Promise<PricingPolicy>;
}
