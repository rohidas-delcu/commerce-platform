import {createHash} from 'node:crypto';
import {PrismaClient,type Prisma} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {withStorefrontSession} from '../../infrastructure/storefront-session.js';
import {releaseCheckout,databaseTime} from '../../checkout/infrastructure/checkout-lifecycle.js';
import {placeCheckout,validateCheckoutPlacement} from '../../checkout/infrastructure/place-checkout.js';
import {DomainError} from '../../domain/commerce.js';
import type {CheckoutContext} from '../../checkout/application/checkout.port.js';
import type {CheckoutSnapshot} from '../../checkout/domain/checkout.js';
import {verifiedObservation,type PaymentAttempt,type ProviderObservation,type SimulationScenario} from '../domain/payments.js';
import type {PaymentRepositoryPort} from '../application/payments.port.js';
export class PrismaPaymentRepository implements PaymentRepositoryPort {
 private client?:PrismaClient;
 constructor(client?:PrismaClient){this.client=client;}
 private get db(){if(!this.client){const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:5},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}return this.client;}
 async onModuleInit(){if(process.env.DATA_DRIVER==='postgres')await this.checkHealth();}
 async checkHealth(){await Promise.all([this.db.paymentAttempt.findFirst({select:{id:true}}),this.db.paymentObservation.findFirst({select:{id:true}})]);}
 async close(){await this.client?.$disconnect();}
 private scope<T>(c:CheckoutContext,work:(tx:Prisma.TransactionClient,customerId:string)=>Promise<T>,access:'commerce'|'account'='account'){return withStorefrontSession(this.db,c.storeId,c.principal,true,(tx,id)=>{if(!id)throw new DomainError('FORBIDDEN','Customer required.');return work(tx,id);},access);}
 async prepare(c:CheckoutContext,checkoutId:string,version:number,key:string,scenario:SimulationScenario,delaySeconds:number){return this.scope(c,async(tx,customerId)=>{
  const digest=createHash('sha256').update(JSON.stringify({checkoutId,version,method:'SIMULATOR',scenario,delaySeconds})).digest('hex'),previous=await tx.paymentAttempt.findUnique({where:{storeId_customerId_key:{storeId:c.storeId,customerId,key}}});
  if(previous){if(previous.digest!==digest)throw new DomainError('CONFLICT','Payment key already used for different input.');return previous;}
  if(await tx.paymentAttempt.findFirst({where:{checkoutId,storeId:c.storeId,customerId}}))throw new DomainError('CONFLICT','A payment already exists for this checkout. Resume it.');
  const checkout=await tx.checkout.findFirst({where:{id:checkoutId,storeId:c.storeId,customerId}}),snapshot=checkout?.snapshot as CheckoutSnapshot|null;
  if(!checkout||checkout.status!=='READY'||!checkout.reservationId||!snapshot)throw new DomainError('CONFLICT','Ready reserved checkout required.');
  const {totals}=await validateCheckoutPlacement(tx,c.storeId,customerId,checkoutId,version,{method:'SIMULATOR',amountMinor:snapshot.totals.totalMinor,currencyCode:snapshot.currencyCode});
  const attempt=await tx.paymentAttempt.create({data:{storeId:c.storeId,customerId,checkoutId,checkoutVersion:version,reservationId:checkout.reservationId,key,digest,method:'SIMULATOR',scenario,delaySeconds,amountMinor:BigInt(totals.totalMinor),currencyCode:snapshot.currencyCode}});await tx.identityAudit.create({data:{identityId:customerId,action:'PAYMENT_INITIATED:'+attempt.id}});return attempt;
 },'commerce');}
 owned(c:CheckoutContext,id:string){return this.scope(c,async(tx,customerId)=>{const row=await tx.paymentAttempt.findFirst({where:{id,storeId:c.storeId,customerId}});if(!row)throw new DomainError('NOT_FOUND','Payment not found.');return row;});}
 find(id:string){return this.db.paymentAttempt.findUnique({where:{id}});}
 // Provider work has no customer session. Preserve identity -> account -> store -> checkout -> payment lock order.
 private async trusted<T>(id:string,work:(tx:Prisma.TransactionClient,row:PaymentAttempt)=>Promise<T>){
  const candidate=await this.db.paymentAttempt.findUnique({where:{id}});if(!candidate)throw new DomainError('NOT_FOUND','Payment not found.');
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Identity" WHERE id=${candidate.customerId}::uuid FOR UPDATE`;
   const store=await tx.store.findUniqueOrThrow({where:{id:candidate.storeId},select:{merchantId:true}});
   await tx.$queryRaw`SELECT id FROM "MerchantAccount" WHERE id=${store.merchantId}::uuid FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${candidate.storeId}::uuid FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "Checkout" WHERE id=${candidate.checkoutId}::uuid FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "PaymentAttempt" WHERE id=${id}::uuid FOR UPDATE`;
   return work(tx,await tx.paymentAttempt.findUniqueOrThrow({where:{id}}));
  },{timeout:15000});
 }
 attach(id:string,providerOrderId:string){return this.trusted(id,async(tx,row)=>{if(!/^[A-Za-z0-9_-]{1,150}$/.test(providerOrderId)||row.providerOrderId&&row.providerOrderId!==providerOrderId)throw new DomainError('CONFLICT','Provider order identity mismatch.');if(row.providerOrderId)return row;return tx.paymentAttempt.update({where:{id},data:{providerOrderId,status:'PENDING'}});});}
 unknown(id:string){return this.trusted(id,async(tx,row)=>{if(!['INITIATING','PENDING','UNKNOWN'].includes(row.status))return row;return tx.paymentAttempt.update({where:{id},data:{status:'UNKNOWN',nextReconcileAt:new Date(Date.now()+30000)}});});}
 record(id:string,o:ProviderObservation){return this.trusted(id,async(tx,row)=>{
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(o.eventId)||!/^\d{1,19}$/.test(o.amountMinor)||BigInt(o.amountMinor)>9223372036854775807n||!/^[A-Z]{3}$/.test(o.currencyCode)||!['PENDING','CAPTURED','FAILED','UNKNOWN'].includes(o.status)||!/^[A-Za-z0-9_-]{1,150}$/.test(o.providerOrderId)||o.providerPaymentId!==null&&!/^[A-Za-z0-9_-]{1,150}$/.test(o.providerPaymentId))throw new DomainError('INVALID','Malformed provider observation.');
  const previous=await tx.paymentObservation.findUnique({where:{attemptId_eventId:{attemptId:id,eventId:o.eventId}}});
  if(previous){if(previous.status!==o.status||previous.amountMinor.toString()!==o.amountMinor||previous.currencyCode!==o.currencyCode||previous.providerOrderId!==o.providerOrderId||previous.providerPaymentId!==o.providerPaymentId)throw new DomainError('CONFLICT','Provider event identity was reused.');return tx.paymentAttempt.update({where:{id},data:{nextReconcileAt:new Date((await databaseTime(tx)).getTime()+30000)}});}
  await tx.paymentObservation.create({data:{attemptId:id,storeId:row.storeId,method:row.method,expectedAmountMinor:row.amountMinor,expectedCurrencyCode:row.currencyCode,eventId:o.eventId,status:o.status,providerOrderId:o.providerOrderId,providerPaymentId:o.providerPaymentId,amountMinor:BigInt(o.amountMinor),currencyCode:o.currencyCode}});
  const nextReconcileAt=new Date((await databaseTime(tx)).getTime()+30000);
  if(!verifiedObservation(row,o))return tx.paymentAttempt.update({where:{id},data:{status:'REVIEW_REQUIRED',reviewCode:'PROVIDER_MISMATCH',nextReconcileAt}});
  if(['SUCCEEDED','REVIEW_REQUIRED','REFUNDED'].includes(row.status))return row;
  if(o.status==='CAPTURED'){
   if(row.providerPaymentId&&row.providerPaymentId!==o.providerPaymentId)return tx.paymentAttempt.update({where:{id},data:{status:'REVIEW_REQUIRED',reviewCode:'MULTIPLE_CAPTURES',nextReconcileAt}});
   await tx.identityAudit.create({data:{action:'PAYMENT_CAPTURE_OBSERVED:'+id}});return tx.paymentAttempt.update({where:{id},data:{status:'CAPTURED',providerPaymentId:o.providerPaymentId,nextReconcileAt}});
  }
  if(row.status==='CAPTURED')return row;
  if(o.status==='FAILED'){
   const checkout=await tx.checkout.findUniqueOrThrow({where:{id:row.checkoutId}});
   if(['DRAFT','READY'].includes(checkout.status)&&checkout.version===row.checkoutVersion){await releaseCheckout(tx,checkout,'system:payment-failure');await tx.checkout.update({where:{id:checkout.id},data:{status:'CANCELLED',version:{increment:1},reservationId:null}});}
   await tx.identityAudit.create({data:{action:'PAYMENT_FAILED:'+id}});return tx.paymentAttempt.update({where:{id},data:{status:'FAILED',nextReconcileAt}});
  }
  if(row.status==='FAILED')return row;
  return tx.paymentAttempt.update({where:{id},data:{status:o.status,nextReconcileAt}});
 });}
 finalize(id:string){return this.trusted(id,async(tx,row)=>{
  if(row.status==='SUCCEEDED')return row;if(row.status!=='CAPTURED'||!row.providerPaymentId||!row.providerOrderId)throw new DomainError('CONFLICT','Verified capture required.');
  if(!await tx.store.findFirst({where:{id:row.storeId,status:'PUBLISHED',suspended:false,archivedAt:null,merchant:{status:'ACTIVE'}}}))throw new DomainError('CONFLICT','Store is unavailable.');
  const checkout=await tx.checkout.findUniqueOrThrow({where:{id:row.checkoutId}});if(checkout.version!==row.checkoutVersion||checkout.reservationId!==row.reservationId)throw new DomainError('CONFLICT','Checkout changed after payment started.');
  const observation=await tx.paymentObservation.findFirst({where:{attemptId:id,status:'CAPTURED',providerPaymentId:row.providerPaymentId,providerOrderId:row.providerOrderId,amountMinor:row.amountMinor,currencyCode:row.currencyCode}});if(!observation)throw new DomainError('CONFLICT','Durable verified receipt required.');
  if(row.method!=='SIMULATOR')throw new DomainError('CONFLICT','Payment provider is not enabled.');
  const order=await placeCheckout(tx,row.storeId,row.customerId,row.checkoutId,row.checkoutVersion,'payment_'+row.id,{method:row.method,amountMinor:row.amountMinor.toString(),currencyCode:row.currencyCode});
  return tx.paymentAttempt.update({where:{id},data:{status:'SUCCEEDED',orderId:order.id}});
 });}
 review(id:string,code:string){return this.trusted(id,async(tx,row)=>{if(row.status==='SUCCEEDED')return row;await tx.identityAudit.create({data:{action:'PAYMENT_REVIEW_REQUIRED:'+id}});return tx.paymentAttempt.update({where:{id},data:{status:'REVIEW_REQUIRED',reviewCode:code}});});}
 async due(limit:number,storeId?:string){const now=await databaseTime(this.db);return(await this.db.paymentAttempt.findMany({where:{status:{in:['INITIATING','PENDING','UNKNOWN','CAPTURED']},nextReconcileAt:{lte:now},...(storeId?{storeId}:{})},orderBy:[{nextReconcileAt:'asc'},{id:'asc'}],take:limit,select:{id:true}})).map(row=>row.id);}
}
