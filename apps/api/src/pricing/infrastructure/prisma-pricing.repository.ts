import type {Coupon,CouponQuery} from '../domain/coupons.js';
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

  private couponDomain(row:{id:string;storeId:string;version:number;code:string;kind:string;value:bigint;active:boolean;startsAt:Date|null;expiresAt:Date|null;maxUses:number|null;perCustomerLimit:number|null;restoreOnCancellation:boolean}):Coupon{return{id:row.id,storeId:row.storeId,version:row.version,code:row.code,kind:row.kind as Coupon['kind'],value:row.value.toString(),active:row.active,startsAt:row.startsAt,expiresAt:row.expiresAt,maxUses:row.maxUses,perCustomerLimit:row.perCustomerLimit,restoreOnCancellation:row.restoreOnCancellation};}
  async coupon(storeId:string,id:string){const row=await this.db.discountCoupon.findFirst({where:{id,storeId}});return row?this.couponDomain(row):null;}
  async couponByCode(storeId:string,code:string){const row=await this.db.discountCoupon.findUnique({where:{storeId_code:{storeId,code}}});return row?this.couponDomain(row):null;}
  async coupons(storeId:string,query:CouponQuery){return(await this.db.discountCoupon.findMany({where:{storeId,...(query.query?{code:{contains:query.query,mode:'insensitive'}}:{})},orderBy:{id:'asc'},skip:query.offset,take:query.limit+1})).map(row=>this.couponDomain(row));}
  private async persistCoupon(coupon:Coupon,actor:string,creating:boolean){return this.transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${coupon.storeId}::uuid FOR UPDATE`;
    const{id,storeId,version,...data}=coupon;
    try{const row=creating?await tx.discountCoupon.create({data:{id,storeId,version:0,...data,value:BigInt(data.value)}}):await tx.discountCoupon.update({where:{id,storeId,version},data:{...data,value:BigInt(data.value),version:{increment:1}}});
      await tx.identityAudit.create({data:{identityId:actor,action:'COUPON_'+(creating?'CREATED:':'CHANGED:')+id}});return this.couponDomain(row);
    }catch(error){if(error&&typeof error==='object'&&'code'in error&&['P2002','P2025'].includes(String(error.code)))throw new DomainError('CONFLICT','Coupon code exists or its version changed.');throw error;}
  });}
  createCoupon(coupon:Coupon,actor:string){return this.persistCoupon(coupon,actor,true);}
  saveCoupon(coupon:Coupon,actor:string){return this.persistCoupon(coupon,actor,false);}

  async couponRule(storeId:string,id:string,customerId:string|null,excludeCartId?:string){const coupon=await this.coupon(storeId,id);if(!coupon)return null;
    const[clock]=await this.db.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;
    const held:Prisma.CouponHoldWhereInput={storeId,couponId:id,status:'HELD',expiresAt:{gt:clock.now},...(excludeCartId&&customerId?{NOT:{checkout:{cartId:excludeCartId},customerId}}:{})};
    const[consumedUses,consumedCustomer,heldUses,heldCustomer]=await Promise.all([
      this.db.couponRedemption.count({where:{storeId,couponId:id,release:null}}),
      customerId?this.db.couponRedemption.count({where:{storeId,couponId:id,customerId,release:null}}):Promise.resolve(0),
      this.db.couponHold.count({where:held}),customerId?this.db.couponHold.count({where:{...held,customerId}}):Promise.resolve(0)
    ]);
    return{id:coupon.id,version:coupon.version,code:coupon.code,kind:coupon.kind,value:coupon.value,active:coupon.active,startsAt:coupon.startsAt,expiresAt:coupon.expiresAt,maxUses:coupon.maxUses,used:consumedUses+heldUses,perCustomerLimit:coupon.perCustomerLimit,customerUses:consumedCustomer+heldCustomer,restoreOnCancellation:coupon.restoreOnCancellation,consumedUses,heldUses};
  }
}
