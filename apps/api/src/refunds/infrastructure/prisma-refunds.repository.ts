import {PrismaPg} from '@prisma/adapter-pg';
import {prepareProviderRefund} from './provider-refund-intents.js';
import {createHash} from 'node:crypto';
import {PrismaClient,type Prisma} from '../../generated/prisma/client.js';
import {DomainError} from '../../domain/commerce.js';
import type {RefundRepositoryPort} from '../application/refunds.port.js';
import {manualRefundInput,type ManualRefundInput,type ProviderRefundInput} from '../domain/refunds.js';
export class PrismaRefundRepository implements RefundRepositoryPort {
 private client?:PrismaClient|Prisma.TransactionClient;
 constructor(client?:PrismaClient|Prisma.TransactionClient){this.client=client;}
 private get db(){if(!this.client){const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:5},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}return this.client;}
 provider(storeId:string,target:'ORDER'|'PAYMENT',targetId:string,actorId:string,input:ProviderRefundInput){return this.transaction(tx=>prepareProviderRefund(tx,storeId,target,targetId,actorId,input));}
 async get(storeId:string,id:string){const row=await this.db.refund.findFirst({where:{id,storeId}});if(!row)throw new DomainError('NOT_FOUND','Refund not found.');return row;}

 private transaction<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>){return '$transaction'in this.db?this.db.$transaction(work):work(this.db);}
 manual(storeId:string,orderId:string,actorId:string,raw:ManualRefundInput){return this.transaction(async tx=>{
  const input=manualRefundInput(raw),digest=createHash('sha256').update(JSON.stringify({orderId,actorId,...input})).digest('hex');
  // Caller provides account/store authority in this same transaction, with the merchant identity locked first.
  await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${storeId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
  const order=await tx.order.findFirst({where:{id:orderId,storeId}});if(!order)throw new DomainError('NOT_FOUND','Order not found.');
  const previous=await tx.refund.findUnique({where:{storeId_key:{storeId,key:input.key}}});if(previous){if(previous.digest!==digest)throw new DomainError('CONFLICT','Refund key already used for different input.');return previous;}
  if(order.version!==input.expectedVersion)throw new DomainError('CONFLICT','Order changed. Refresh before recording a refund.');
  if(order.paymentMethod!=='COD'||!['PAID','PARTIALLY_REFUNDED'].includes(order.paymentStatus)||order.paidMinor<=0n)throw new DomainError('CONFLICT','Only collected COD can record a manual cash refund.');
  const amount=BigInt(input.amountMinor);if(amount>order.paidMinor-order.refundedMinor)throw new DomainError('CONFLICT','Refund exceeds the unrefunded collected amount.');
  const refund=await tx.refund.create({data:{storeId,orderId,actorId,key:input.key,digest,method:'MANUAL_COD',status:'SUCCEEDED',amountMinor:amount,currencyCode:order.currencyCode,reference:input.reference}}),refundedMinor=order.refundedMinor+amount;
  await tx.order.update({where:{id:orderId},data:{refundedMinor,paymentStatus:refundedMinor===order.paidMinor?'REFUNDED':'PARTIALLY_REFUNDED',version:{increment:1}}});
  await tx.orderEvent.create({data:{orderId,storeId,actorId,kind:'REFUND_RECORDED',data:{refundId:refund.id,amountMinor:amount.toString(),method:'MANUAL_COD'}}});
  await tx.orderNotification.create({data:{orderId,storeId,kind:'REFUND_RECORDED',key:orderId+':REFUND_RECORDED:'+refund.id}});
  await tx.identityAudit.create({data:{identityId:actorId,action:'MANUAL_COD_REFUND_RECORDED:'+refund.id}});return refund;
 });}
 async payment(storeId:string,id:string){const row=await this.db.paymentAttempt.findFirst({where:{id,storeId}});if(!row)throw new DomainError('NOT_FOUND','Payment not found.');return row;}
 async payments(storeId:string,limit:number,offset:number){return this.db.paymentAttempt.findMany({where:{storeId},orderBy:[{createdAt:'desc'},{id:'asc'}],take:limit+1,skip:offset});}
 async list(storeId:string,orderId:string,limit:number,offset:number){if(!await this.db.order.findFirst({where:{id:orderId,storeId},select:{id:true}}))throw new DomainError('NOT_FOUND','Order not found.');return this.db.refund.findMany({where:{storeId,orderId},orderBy:[{createdAt:'desc'},{id:'asc'}],take:limit+1,skip:offset});}
}
