import {Logger} from '@nestjs/common';
import {PrismaClient,Prisma} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {databaseTime,expireCheckout} from '../../checkout/infrastructure/checkout-lifecycle.js';
import {expireCart} from '../../cart/infrastructure/cart-lifecycle.js';
import {PrismaInventoryRepository} from '../../inventory/infrastructure/prisma-inventory.repository.js';
import type {MaintenanceRepositoryPort,ExpiryResult} from '../application/maintenance.port.js';
export class PrismaMaintenanceRepository implements MaintenanceRepositoryPort {
 private client?:PrismaClient;
 constructor(client?:PrismaClient){this.client=client;}
 private get db(){if(!this.client){const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:5},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}return this.client;}
 async onModuleInit(){if(process.env.DATA_DRIVER==='postgres')await this.checkHealth();}
 async close(){await this.client?.$disconnect();}
 async checkHealth(){await Promise.all([this.db.checkout.findFirst({select:{expiresAt:true}}),this.db.inventoryReservation.findFirst({select:{expiresAt:true}}),this.db.cart.findFirst({select:{expiresAt:true}})]);}
 async expire(limit:number,storeId?:string){
  const result:ExpiryResult={checkouts:0,reservations:0,carts:0,skipped:0,failed:0};
  for(const kind of ['checkouts','reservations','carts'] as const){
   const table=Prisma.raw(kind==='checkouts'?'"Checkout"':kind==='reservations'?'"InventoryReservation"':'"Cart"'),state=kind==='checkouts'?Prisma.sql`status IN ('DRAFT','READY')`:Prisma.sql`status='ACTIVE'`,tenant=storeId?Prisma.sql`AND "storeId"=${storeId}::uuid`:Prisma.empty;
   const candidates=await this.db.$queryRaw<{id:string;storeId:string}[]>(Prisma.sql`SELECT id,"storeId" FROM ${table} WHERE ${state} AND "expiresAt"<=clock_timestamp() ${tenant} ORDER BY "expiresAt",id LIMIT ${limit}`);
   for(const candidate of candidates){
    try{
     const changed=await this.db.$transaction(async tx=>{
      const store=await tx.store.findUnique({where:{id:candidate.storeId},select:{merchantId:true}});if(!store)return false;
      // Never acquire identity/session locks after account/store. There is no impersonated session.
      const account=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "MerchantAccount" WHERE id=${store.merchantId}::uuid FOR UPDATE SKIP LOCKED`;if(!account.length)return false;
      const locked=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Store" WHERE id=${candidate.storeId}::uuid FOR UPDATE SKIP LOCKED`;if(!locked.length)return false;
      const rows=await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM ${table} WHERE id=${candidate.id}::uuid AND "storeId"=${candidate.storeId}::uuid AND ${state} AND "expiresAt"<=clock_timestamp() FOR UPDATE SKIP LOCKED`);if(!rows.length)return false;
      if(kind==='checkouts'){const row=await tx.checkout.findUniqueOrThrow({where:{id:candidate.id}});return(await expireCheckout(tx,row,null)).status==='EXPIRED';}
      if(kind==='reservations'){await new PrismaInventoryRepository(tx).transition(candidate.storeId,candidate.id,'expire','system:expiry',await databaseTime(tx));return true;}
      const changed=await expireCart(tx,candidate.id,await databaseTime(tx));if(changed)await tx.identityAudit.create({data:{action:'CART_EXPIRED:'+candidate.id}});return changed;
     },{timeout:15000});
     if(changed)result[kind]++;else result.skipped++;
    }catch{result.failed++;Logger.error({event:'commerce_expiry_failed',kind},undefined,'Maintenance');}
   }
  }
  return result;
 }
}
