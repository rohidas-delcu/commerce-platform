import {randomUUID} from 'node:crypto';
import {PrismaClient} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {databaseTime} from '../../checkout/infrastructure/checkout-lifecycle.js';
import {PrismaMediaRepository} from '../../media/infrastructure/prisma-media.repository.js';
import {mediaAsset} from '../../media/infrastructure/media.mapper.js';
import type {CleanupClaim,CleanupRepositoryPort} from '../application/cleanup.port.js';
export class PrismaCleanupRepository implements CleanupRepositoryPort {
 private client?:PrismaClient;
 constructor(client?:PrismaClient){this.client=client;}
 private get db(){if(!this.client){const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:5},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}return this.client;}
 async onModuleInit(){if(process.env.DATA_DRIVER==='postgres')await this.checkHealth();}
 async close(){await this.client?.$disconnect();}
 async checkHealth(){await this.db.mediaAsset.findFirst({select:{cleanupAfter:true,cleanupLease:true,cleanupCheckedAt:true}});}
 async claim(limit:number,provider:string,storeId?:string){
  const now=await databaseTime(this.db),cutoff=new Date(now.getTime()-600000),candidates=await this.db.mediaAsset.findMany({where:{provider,cleanupAfter:{lte:now},...(storeId?{storeId}:{}),images:{none:{}},logoStores:{none:{}},OR:[{status:'DELETED'},{status:'PENDING',expiresAt:{lte:cutoff}}]},orderBy:[{cleanupAfter:'asc'},{id:'asc'}],take:limit,select:{id:true,storeId:true}}),claims:CleanupClaim[]=[];let skipped=0;
  for(const candidate of candidates){const claim=await this.db.$transaction(async tx=>{
   const store=await tx.store.findUnique({where:{id:candidate.storeId},select:{merchantId:true}});if(!store)return null;
   const accounts=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "MerchantAccount" WHERE id=${store.merchantId}::uuid FOR UPDATE SKIP LOCKED`;if(!accounts.length)return null;
   const stores=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Store" WHERE id=${candidate.storeId}::uuid FOR UPDATE SKIP LOCKED`;if(!stores.length)return null;
   const assets=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "MediaAsset" WHERE id=${candidate.id}::uuid AND "storeId"=${candidate.storeId}::uuid FOR UPDATE SKIP LOCKED`;if(!assets.length)return null;
   const row=await tx.mediaAsset.findUniqueOrThrow({where:{id:candidate.id}}),clock=await databaseTime(tx);
   if(row.provider!==provider||row.cleanupAfter>clock||row.status!=='DELETED'&&(row.status!=='PENDING'||row.expiresAt>new Date(clock.getTime()-600000)))return null;
   if(await tx.productMedia.count({where:{assetId:row.id}})||await tx.store.count({where:{logoAssetId:row.id}}))return null;
   if(row.status==='PENDING'){await new PrismaMediaRepository(tx).remove(row.storeId,row.id);await tx.identityAudit.create({data:{action:'MEDIA_UPLOAD_EXPIRED:'+row.id}});}
   const leaseToken=randomUUID(),saved=await tx.mediaAsset.update({where:{id:row.id},data:{cleanupLease:leaseToken,cleanupAfter:new Date(clock.getTime()+300000)}});return{asset:mediaAsset(saved),leaseToken};
  },{timeout:15000});if(claim)claims.push(claim);else skipped++;}
  return{claims,skipped};
 }
 async accepted(claim:CleanupClaim){const now=await databaseTime(this.db);return(await this.db.mediaAsset.updateMany({where:{id:claim.asset.id,storeId:claim.asset.storeId,key:claim.asset.key,provider:claim.asset.provider,status:'DELETED',cleanupLease:claim.leaseToken},data:{cleanupCheckedAt:now,cleanupAfter:new Date(now.getTime()+86400000),cleanupLease:null}})).count===1;}
}
