import {randomUUID} from 'node:crypto';
import {PrismaClient,Prisma} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import type {NotificationRepositoryPort,NotificationSelector} from '../application/notifications.port.js';
import {retryDelayMs,type NotificationJob,type DeliveryOutcome,type IdentityMailContext,type OrderMailContext} from '../domain/notifications.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export class PrismaNotificationRepository implements NotificationRepositoryPort {
  private client?:PrismaClient;
  constructor(client?:PrismaClient){this.client=client;}
  private get db(){if(!this.client){const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:5},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}return this.client;}
  async onModuleInit(){if(process.env.DATA_DRIVER==='postgres')await this.checkHealth();}
  async close(){await this.client?.$disconnect();}
  async checkHealth(){await Promise.all([this.db.notificationAttempt.findFirst({select:{id:true}}),this.db.identityMail.findFirst({select:{status:true}}),this.db.orderNotification.findFirst({select:{leaseToken:true}})]);}
  async claim(limit:number,provider:string,idempotent:boolean,only?:NotificationSelector){
    if(only&&(!['identity','order'].includes(only.source)||!uuid.test(only.id)))throw new Error('Invalid notification selector.');
    return this.db.$transaction(async tx=>{
      const jobs:NotificationJob[]=[];let recoveredUnknown=0;
      for(const source of ['identity','order'] as const){
        if(only&&only.source!==source)continue;
        const table=Prisma.raw(source==='identity'?'"IdentityMail"':'"OrderNotification"'),filter=only?Prisma.sql`AND id=${only.id}::uuid`:Prisma.empty;
        // SKIP LOCKED allows multiple workers without waiting on one another. Recover in bounded batches.
        const expired=await tx.$queryRaw<{id:string;provider:string|null;leaseToken:string|null;attempts:number}[]>(Prisma.sql`SELECT id,provider,"leaseToken",attempts FROM ${table} WHERE status='SENDING' AND "lockedUntil"<=clock_timestamp() ${filter} ORDER BY "lockedUntil",id LIMIT ${limit} FOR UPDATE SKIP LOCKED`);
        for(const row of expired){const retry=idempotent&&row.provider===provider&&row.attempts<5;
          await tx.$executeRaw(Prisma.sql`UPDATE ${table} SET status=${retry?'PENDING':'UNKNOWN'},"lockedUntil"=NULL,"lastErrorCode"='LEASE_EXPIRED' WHERE id=${row.id}::uuid`);
          if(row.leaseToken)await tx.notificationAttempt.updateMany({where:{leaseToken:row.leaseToken,status:'SENDING'},data:{status:'UNKNOWN',errorCode:'LEASE_EXPIRED',finishedAt:new Date()}});
          if(!retry)recoveredUnknown++;
        }
        const capacity=only?limit:source==='identity'?Math.ceil(limit/2):limit-jobs.length;
        const selected=await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM ${table} WHERE status='PENDING' AND "availableAt"<=clock_timestamp() ${filter} ORDER BY "availableAt",id LIMIT ${capacity} FOR UPDATE SKIP LOCKED`);
        for(const row of selected){
          const leaseToken=randomUUID(),data={status:'SENDING',leaseToken,provider,attempts:{increment:1},lastErrorCode:null};
          // Lease uses the database clock, including time spent waiting for locks.
          await tx.$executeRaw(Prisma.sql`UPDATE ${table} SET "lockedUntil"=clock_timestamp()+interval '5 minutes' WHERE id=${row.id}::uuid`);
          if(source==='identity'){
            const mail=await tx.identityMail.update({where:{id:row.id},data});
            await tx.notificationAttempt.create({data:{identityMailId:mail.id,identityScopeKey:mail.scopeKey,leaseToken,provider,attemptNumber:mail.attempts}});
            jobs.push({source,id:mail.id,messageId:'identity_'+mail.id,leaseToken,attempts:mail.attempts,createdAt:mail.createdAt,recipient:mail.recipient,purpose:mail.purpose,scopeKey:mail.scopeKey,encryptedPayload:mail.encryptedPayload});
          }else{
            const mail=await tx.orderNotification.update({where:{id:row.id},data});
            await tx.notificationAttempt.create({data:{orderNotificationId:mail.id,storeId:mail.storeId,leaseToken,provider,attemptNumber:mail.attempts}});
            jobs.push({source,id:mail.id,messageId:'order_'+mail.id,leaseToken,attempts:mail.attempts,createdAt:mail.createdAt,purpose:mail.kind,storeId:mail.storeId,orderId:mail.orderId});
          }
        }
      }
      return{jobs,recoveredUnknown};
    });
  }
  async identityContext(job:NotificationJob,tokenDigest:string):Promise<IdentityMailContext|null>{
    const[{now}]=await this.db.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;
    if(job.purpose==='INVITE'){
      const invitation=await this.db.merchantInvitation.findUnique({where:{digest:tokenDigest},include:{merchant:true,inviter:true}});
      if(!invitation||job.scopeKey!=='merchant'||invitation.email!==job.recipient||invitation.consumedAt||invitation.revokedAt||invitation.expiresAt<=now||invitation.merchant.status!=='ACTIVE'||invitation.inviter.status!=='ACTIVE'||!invitation.inviter.verifiedAt)return null;
      const issuer=await this.db.merchantMembership.findUnique({where:{merchantId_identityId:{merchantId:invitation.merchantId,identityId:invitation.inviterId}}});
      if(issuer?.role!=='ACCOUNT_OWNER')return null;
      if(invitation.storeId&&!await this.db.store.findFirst({where:{id:invitation.storeId,merchantId:invitation.merchantId,archivedAt:null,suspended:false}}))return null;
      return{purpose:'INVITE',audience:'merchant',storeHandle:null,name:'there',expiresAt:invitation.expiresAt};
    }
    if(job.purpose!=='VERIFY'&&job.purpose!=='RESET')return null;
    const challenge=await this.db.identityChallenge.findUnique({where:{digest:tokenDigest},include:{identity:true}});
    if(!challenge||challenge.purpose!==job.purpose||challenge.consumedAt||challenge.expiresAt<=now)return null;
    const identity=challenge.identity;
    if(identity.scopeKey!==job.scopeKey||identity.email!==job.recipient||identity.status!=='ACTIVE'||job.purpose==='VERIFY'&&identity.verifiedAt)return null;
    const store=identity.customerStoreId?await this.db.store.findUnique({where:{id:identity.customerStoreId},select:{handle:true}}):null;
    return{purpose:job.purpose,audience:identity.customerStoreId?'customer':'merchant',storeHandle:store?.handle??null,name:identity.name,expiresAt:challenge.expiresAt};
  }
  async orderContext(job:NotificationJob):Promise<OrderMailContext|null>{
    const mail=await this.db.orderNotification.findFirst({where:{id:job.id,storeId:job.storeId,orderId:job.orderId},include:{order:{include:{store:{select:{handle:true}},events:{where:{kind:'DISPATCH'},orderBy:{createdAt:'desc'},take:1}}}}});
    if(!mail)return null;const order=mail.order,data=order.events[0]?.data,dispatch=data&&typeof data==='object'&&!Array.isArray(data)?data:{};
    return{recipient:order.contactEmail,name:order.contactName,handle:order.store.handle,number:order.number,orderId:order.id,currencyCode:order.currencyCode,totalMinor:order.totalMinor.toString(),paidMinor:order.paidMinor.toString(),paymentMethod:order.paymentMethod,carrier:typeof dispatch.carrier==='string'?dispatch.carrier:null,reference:typeof dispatch.reference==='string'?dispatch.reference:null};
  }
  async finish(job:NotificationJob,outcome:DeliveryOutcome){
    return this.db.$transaction(async tx=>{
      const table=Prisma.raw(job.source==='identity'?'"IdentityMail"':'"OrderNotification"');
      await tx.$queryRaw(Prisma.sql`SELECT id FROM ${table} WHERE id=${job.id}::uuid FOR UPDATE`);
      const attempt=await tx.notificationAttempt.findUniqueOrThrow({where:{leaseToken:job.leaseToken}});
      if(attempt.status==='ACCEPTED')return false;
      const accepted=outcome.kind==='accepted',retry=outcome.kind==='retryable'&&job.attempts<5;
      const status=accepted?'ACCEPTED':retry?'PENDING':outcome.kind==='unknown'?'UNKNOWN':outcome.kind==='cancelled'?'CANCELLED':'FAILED';
      const code=accepted?null:outcome.kind==='retryable'&&!retry?'RETRY_LIMIT':outcome.code;
      const now=new Date(),receipt=accepted?outcome.providerMessageId:null;
      await tx.notificationAttempt.update({where:{id:attempt.id},data:{status:accepted?'ACCEPTED':outcome.kind.toUpperCase(),finishedAt:now,errorCode:code,providerMessageId:receipt}});
      const count=await tx.$executeRaw(Prisma.sql`UPDATE ${table} SET status=${status},"lockedUntil"=NULL,"lastErrorCode"=${code},"providerMessageId"=${receipt},"acceptedAt"=${accepted?now:null},"availableAt"=clock_timestamp()+${retry?retryDelayMs(job.attempts):0}*interval '1 millisecond' WHERE id=${job.id}::uuid AND "leaseToken"=${job.leaseToken}::uuid AND status IN ('SENDING','UNKNOWN')`);
      await tx.identityAudit.create({data:{action:'NOTIFICATION_'+status+':'+attempt.id}});
      return count===1;
    });
  }
}
