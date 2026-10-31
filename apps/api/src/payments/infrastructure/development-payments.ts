import {PrismaClient,type Prisma} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {DomainError} from '../../domain/commerce.js';
import {databaseTime} from '../../checkout/infrastructure/checkout-lifecycle.js';
import {assertDevelopmentPayment,type PaymentAttempt,type ProviderObservation,type ProviderStatus} from '../domain/payments.js';
import type {DevelopmentPaymentPort} from '../application/payments.port.js';
// This is a durable development provider, never evidence of a live bank/gateway transaction.
export class DevelopmentPaymentSimulator implements DevelopmentPaymentPort {
 readonly method='SIMULATOR';readonly idempotentCreation=true;private client?:PrismaClient;
 constructor(client?:PrismaClient){this.client=client;}
 private get db(){if(!this.client){const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:5},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}return this.client;}
 async checkHealth(){await Promise.all([this.db.simulatedPayment.findFirst({select:{attemptId:true}}),this.db.simulatedPaymentEvent.findFirst({select:{id:true}})]);}
 async close(){await this.client?.$disconnect();}
 private async transaction<T>(attempt:PaymentAttempt,work:(tx:Prisma.TransactionClient)=>Promise<T>){assertDevelopmentPayment();if(attempt.method!=='SIMULATOR')throw new DomainError('FORBIDDEN','Simulator cannot act on another provider.');return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "PaymentAttempt" WHERE id=${attempt.id}::uuid FOR UPDATE`;return work(tx);});}
 async create(attempt:PaymentAttempt){return this.transaction(attempt,async tx=>{
  const previous=await tx.simulatedPayment.findUnique({where:{attemptId:attempt.id}});if(previous)return{providerOrderId:'sim_order_'+attempt.id};
  const status=attempt.scenario==='SUCCESS'?'CAPTURED':attempt.scenario==='FAILURE'?'FAILED':attempt.scenario==='TIMEOUT'?'UNKNOWN':'PENDING';
  const now=await databaseTime(tx);await tx.simulatedPayment.create({data:{attemptId:attempt.id,storeId:attempt.storeId,method:'SIMULATOR',amountMinor:attempt.amountMinor,currencyCode:attempt.currencyCode,scenario:attempt.scenario,status,dueAt:attempt.scenario==='DELAYED'?new Date(now.getTime()+attempt.delaySeconds*1000):null,events:{create:{key:'initial',kind:status,sequence:0}}}});
  return{providerOrderId:'sim_order_'+attempt.id};
 });}
 async observe(attempt:PaymentAttempt):Promise<ProviderObservation>{return this.transaction(attempt,async tx=>{
  let state=await tx.simulatedPayment.findUniqueOrThrow({where:{attemptId:attempt.id}});
  if(state.scenario==='DELAYED'&&['PENDING','UNKNOWN'].includes(state.status)&&state.dueAt&&state.dueAt<=await databaseTime(tx)){
   state=await tx.simulatedPayment.update({where:{attemptId:attempt.id},data:{status:'CAPTURED',version:{increment:1},events:{create:{key:'scheduled_capture',kind:'CAPTURED',sequence:state.version+1}}}});
  }
  const event=await tx.simulatedPaymentEvent.findUniqueOrThrow({where:{attemptId_sequence:{attemptId:attempt.id,sequence:state.version}}});
  return{eventId:'sim_'+event.id,status:state.status as ProviderStatus,providerOrderId:'sim_order_'+attempt.id,providerPaymentId:state.status==='CAPTURED'?'sim_payment_'+attempt.id:null,amountMinor:state.amountMinor.toString(),currencyCode:state.currencyCode};
 });}
 async simulate(attempt:PaymentAttempt,key:string,kind:ProviderStatus){await this.transaction(attempt,async tx=>{
  const state=await tx.simulatedPayment.findUniqueOrThrow({where:{attemptId:attempt.id}}),previous=await tx.simulatedPaymentEvent.findUnique({where:{attemptId_key:{attemptId:attempt.id,key}}});
  if(previous){if(previous.kind!==kind)throw new DomainError('CONFLICT','Simulator event key already used for a different result.');return;}
  const status=state.status==='CAPTURED'?'CAPTURED':state.status==='FAILED'&&['UNKNOWN','PENDING'].includes(kind)?'FAILED':kind;
  await tx.simulatedPayment.update({where:{attemptId:attempt.id},data:{status,version:{increment:1},events:{create:{key,kind,sequence:state.version+1}}}});
 });}
}
