import type {PrismaClient,Prisma} from '../../generated/prisma/client.js';
import {DomainError} from '../../domain/commerce.js';
import {pricingPolicy,type PricingPolicy} from '../domain/pricing.js';
import type {PricingRepositoryPort} from '../application/pricing.port.js';
export class PrismaPricingRepository implements PricingRepositoryPort {
  constructor(private db:PrismaClient|Prisma.TransactionClient){}
  private decode(row:{version:number;shipping:unknown;tax:unknown;payments:unknown}){return pricingPolicy(row as PricingPolicy);}
  async policy(storeId:string){const row=await this.db.storePricing.findUnique({where:{storeId}});return row?this.decode(row):null;}
  async savePolicy(storeId:string,policy:PricingPolicy,actor:string):Promise<PricingPolicy>{
    return this.transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${storeId}::uuid FOR UPDATE`;
    const{version,...values}=pricingPolicy(policy);
    const data={shipping:values.shipping.map(m=>({...m})),tax:{...values.tax,rates:values.tax.rates.map(r=>({...r}))},payments:{...values.payments}};
    try{
      const current=await tx.storePricing.findUnique({where:{storeId},select:{version:true}});
      if((current?.version??0)!==version)throw new DomainError('CONFLICT','Pricing configuration changed.');
      const saved=current?await tx.storePricing.update({where:{storeId,version},data:{...data,version:{increment:1}}}):await tx.storePricing.create({data:{storeId,...data,version:1}});
      await tx.identityAudit.create({data:{identityId:actor,action:'PRICING_CHANGED:'+storeId}});return this.decode(saved);
    }catch(error){if(error&&typeof error==='object'&&'code'in error&&['P2002','P2025'].includes(String(error.code)))throw new DomainError('CONFLICT','Pricing configuration changed.');throw error;}
    });
  }
  private transaction<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>){return '$transaction'in this.db?this.db.$transaction(work):work(this.db);}
}
