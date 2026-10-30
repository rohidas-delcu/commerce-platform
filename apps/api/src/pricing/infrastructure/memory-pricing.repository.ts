import {DomainError} from '../../domain/commerce.js';
import {pricingPolicy,type PricingPolicy} from '../domain/pricing.js';
import type {PricingRepositoryPort} from '../application/pricing.port.js';
export class MemoryPricingRepository implements PricingRepositoryPort {
  private policies=new Map<string,PricingPolicy>();
  async policy(id:string){return structuredClone(this.policies.get(id)??null);}
  async savePolicy(id:string,input:PricingPolicy,_actor:string){const policy=pricingPolicy(input),current=this.policies.get(id);if((current?.version??0)!==policy.version)throw new DomainError('CONFLICT','Pricing configuration changed.');const saved={...policy,version:policy.version+1};this.policies.set(id,structuredClone(saved));return structuredClone(saved);}
}
