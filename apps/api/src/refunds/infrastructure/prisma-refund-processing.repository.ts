import {PrismaClient,type Prisma} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {DomainError} from '../../domain/commerce.js';
import {databaseTime} from '../../checkout/infrastructure/checkout-lifecycle.js';
import type {RefundProcessingPort} from '../application/refunds.port.js';
import type {Refund,RefundObservation,RefundRequest} from '../domain/refunds.js';
export class PrismaRefundProcessingRepository implements RefundProcessingPort {
 private client?:PrismaClient;
 constructor(client?:PrismaClient){this.client=client;}
 private get db(){if(!this.client){const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:5},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}return this.client;}
 async onModuleInit(){if(process.env.DATA_DRIVER==='postgres')await this.checkHealth();}
 async checkHealth(){await Promise.all([this.db.refund.findFirst({select:{providerRefundId:true}}),this.db.refundObservation.findFirst({select:{id:true}}),this.db.simulatedRefund.findFirst({select:{refundId:true}})]);}
 async close(){await this.client?.$disconnect();}
 private async trusted<T>(id:string,work:(tx:Prisma.TransactionClient,row:Refund)=>Promise<T>){const candidate=await this.db.refund.findUnique({where:{id}});if(!candidate)throw new DomainError('NOT_FOUND','Refund not found.');return this.db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Identity" WHERE id=${candidate.actorId}::uuid FOR UPDATE`;
  const store=await tx.store.findUniqueOrThrow({where:{id:candidate.storeId},select:{merchantId:true}});await tx.$queryRaw`SELECT id FROM "MerchantAccount" WHERE id=${store.merchantId}::uuid FOR UPDATE`;await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${candidate.storeId}::uuid FOR UPDATE`;
  if(candidate.paymentId)await tx.$queryRaw`SELECT id FROM "PaymentAttempt" WHERE id=${candidate.paymentId}::uuid FOR UPDATE`;
  if(candidate.orderId)await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${candidate.orderId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Refund" WHERE id=${id}::uuid FOR UPDATE`;return work(tx,await tx.refund.findUniqueOrThrow({where:{id}}));
 },{timeout:15000});}
 async request(id:string):Promise<RefundRequest>{const row=await this.db.refund.findUnique({where:{id},include:{payment:true}});if(!row||row.method!=='SIMULATOR'||!row.payment?.providerPaymentId)throw new DomainError('CONFLICT','Supported captured refund source required.');return{...row,providerPaymentId:row.payment.providerPaymentId};}
 attach(id:string,providerRefundId:string){return this.trusted(id,async(tx,row)=>{if(row.providerRefundId){if(row.providerRefundId!==providerRefundId)throw new DomainError('CONFLICT','Refund receipt changed.');return row;}if(!/^[A-Za-z0-9_-]{1,150}$/.test(providerRefundId))throw new DomainError('INVALID','Invalid refund receipt.');return tx.refund.update({where:{id},data:{providerRefundId,status:'PENDING'}});});}
 unknown(id:string){return this.trusted(id,async(tx,row)=>{if(!['CREATED','PENDING','UNKNOWN'].includes(row.status))return row;return tx.refund.update({where:{id},data:{status:'UNKNOWN',nextReconcileAt:new Date((await databaseTime(tx)).getTime()+30000)}});});}
 record(id:string,o:RefundObservation){return this.trusted(id,async(tx,row)=>{
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(o.eventId)||!/^[A-Za-z0-9_-]{1,150}$/.test(o.providerRefundId)||!/^\d{1,19}$/.test(o.amountMinor)||BigInt(o.amountMinor)>9223372036854775807n||!/^[A-Z]{3}$/.test(o.currencyCode)||!['PROCESSED','FAILED','PENDING','UNKNOWN'].includes(o.status))throw new DomainError('INVALID','Invalid provider refund observation.');
  const previous=await tx.refundObservation.findUnique({where:{refundId_eventId:{refundId:id,eventId:o.eventId}}}),nextReconcileAt=new Date((await databaseTime(tx)).getTime()+30000);
  if(previous){if(previous.status!==o.status||previous.providerRefundId!==o.providerRefundId||previous.amountMinor.toString()!==o.amountMinor||previous.currencyCode!==o.currencyCode)throw new DomainError('CONFLICT','Refund event identity reused.');return tx.refund.update({where:{id},data:{nextReconcileAt}});}
  await tx.refundObservation.create({data:{refundId:id,storeId:row.storeId,eventId:o.eventId,status:o.status,providerRefundId:o.providerRefundId,amountMinor:BigInt(o.amountMinor),currencyCode:o.currencyCode}});
  if(row.status==='SUCCEEDED')return row;
  if(BigInt(o.amountMinor)!==row.amountMinor||o.currencyCode!==row.currencyCode||o.providerRefundId!==row.providerRefundId)return tx.refund.update({where:{id},data:{status:'REVIEW_REQUIRED',reviewCode:'PROVIDER_REFUND_MISMATCH',nextReconcileAt}});
  if(['SUCCEEDED','REVIEW_REQUIRED','CONFIRMED'].includes(row.status))return row;
  if(row.status==='FAILED'&&o.status!=='PROCESSED')return row;
  const status=o.status==='PROCESSED'?'CONFIRMED':o.status==='FAILED'?'FAILED':o.status;return tx.refund.update({where:{id},data:{status,nextReconcileAt}});
 });}
 finalize(id:string){return this.trusted(id,async(tx,row)=>{
  if(row.status==='SUCCEEDED')return row;if(row.status!=='CONFIRMED'||!row.paymentId||!row.providerRefundId)throw new DomainError('CONFLICT','Confirmed provider refund required.');
  if(!await tx.refundObservation.findFirst({where:{refundId:id,status:'PROCESSED',providerRefundId:row.providerRefundId,amountMinor:row.amountMinor,currencyCode:row.currencyCode}}))throw new DomainError('CONFLICT','Durable matching refund receipt required.');
  const payment=await tx.paymentAttempt.findUniqueOrThrow({where:{id:row.paymentId}}),refunded=payment.refundedMinor+row.amountMinor;if(refunded>payment.amountMinor)throw new DomainError('CONFLICT','Refund exceeds captured money.');
  await tx.refund.update({where:{id},data:{status:'SUCCEEDED'}});
  await tx.paymentAttempt.update({where:{id:row.paymentId},data:{refundedMinor:refunded,...(refunded===payment.amountMinor?{status:'REFUNDED',reviewCode:null}:{})}});
  if(row.orderId){const order=await tx.order.findUniqueOrThrow({where:{id:row.orderId}}),total=order.refundedMinor+row.amountMinor;if(total>order.paidMinor)throw new DomainError('CONFLICT','Refund exceeds gross paid.');await tx.order.update({where:{id:order.id},data:{refundedMinor:total,paymentStatus:total===order.paidMinor?'REFUNDED':'PARTIALLY_REFUNDED',version:{increment:1}}});await tx.orderEvent.create({data:{orderId:order.id,storeId:row.storeId,actorId:row.actorId,kind:'REFUND_RECORDED',data:{refundId:id,amountMinor:row.amountMinor.toString(),method:row.method}}});await tx.orderNotification.create({data:{orderId:order.id,storeId:row.storeId,kind:'REFUND_RECORDED',key:order.id+':REFUND_RECORDED:'+id}});}
  await tx.identityAudit.create({data:{identityId:row.actorId,action:'PROVIDER_REFUND_RECORDED:'+id}});return tx.refund.findUniqueOrThrow({where:{id}});
 });}
 review(id:string,code:string){return this.trusted(id,async(tx,row)=>{if(row.status==='SUCCEEDED')return row;await tx.identityAudit.create({data:{identityId:row.actorId,action:'REFUND_REVIEW_REQUIRED:'+id}});return tx.refund.update({where:{id},data:{status:'REVIEW_REQUIRED',reviewCode:code}});});}
 async due(limit:number,storeId?:string){return(await this.db.refund.findMany({where:{method:'SIMULATOR',status:{in:['CREATED','PENDING','UNKNOWN','CONFIRMED']},nextReconcileAt:{lte:await databaseTime(this.db)},...(storeId?{storeId}:{})},orderBy:[{nextReconcileAt:'asc'},{id:'asc'}],take:limit,select:{id:true}})).map(row=>row.id);}
}
