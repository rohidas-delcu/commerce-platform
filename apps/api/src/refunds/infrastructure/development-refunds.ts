import {PrismaClient,type Prisma} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {DomainError} from '../../domain/commerce.js';
import {assertDevelopmentPayment} from '../../payments/domain/payments.js';
import type {DevelopmentRefundPort} from '../application/refunds.port.js';
import type {RefundRequest,RefundObservation,RefundProviderStatus} from '../domain/refunds.js';
export class DevelopmentRefundSimulator implements DevelopmentRefundPort {
 readonly method='SIMULATOR';readonly idempotentCreation=true;private client?:PrismaClient;
 constructor(client?:PrismaClient){this.client=client;}
 private get db(){if(!this.client){const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:5},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}return this.client;}
 async close(){await this.client?.$disconnect();}
 private async transaction<T>(request:RefundRequest,work:(tx:Prisma.TransactionClient)=>Promise<T>){assertDevelopmentPayment();if(request.method!=='SIMULATOR'||!request.paymentId)throw new DomainError('FORBIDDEN','Unsupported development refund.');const paymentId=request.paymentId;return this.db.$transaction(async tx=>{
  const locked=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "PaymentAttempt" WHERE id=${paymentId}::uuid AND "storeId"=${request.storeId}::uuid AND method='SIMULATOR' FOR UPDATE`;if(!locked.length)throw new DomainError('NOT_FOUND','Scoped payment not found.');
  const source=await tx.simulatedPayment.findFirst({where:{attemptId:paymentId,storeId:request.storeId,status:'CAPTURED'}});if(!source||request.providerPaymentId!=='sim_payment_'+request.paymentId||source.currencyCode!==request.currencyCode)throw new DomainError('CONFLICT','Simulated captured source required.');return work(tx);
 });}
 private async budget(tx:Prisma.TransactionClient,r:RefundRequest){const source=await tx.simulatedPayment.findUniqueOrThrow({where:{attemptId:r.paymentId!}}),other=await tx.simulatedRefund.aggregate({where:{refund:{paymentId:r.paymentId},refundId:{not:r.id},status:{not:'FAILED'}},_sum:{amountMinor:true}});if((other._sum.amountMinor??0n)+r.amountMinor>source.amountMinor)throw new DomainError('CONFLICT','Provider refuses refunds above captured money.');}
 async create(request:RefundRequest){const result=await this.transaction(request,async tx=>{
  let state=await tx.simulatedRefund.findFirst({where:{refundId:request.id,storeId:request.storeId}});if(!state){await this.budget(tx,request);state=await tx.simulatedRefund.create({data:{refundId:request.id,storeId:request.storeId,method:'SIMULATOR',amountMinor:request.amountMinor,currencyCode:request.currencyCode,status:request.simulationScenario==='FAILURE'?'FAILED':request.simulationScenario==='TIMEOUT'?'UNKNOWN':'PROCESSED'}});}
  return{providerRefundId:'sim_refund_'+request.id,uncertain:state.status==='UNKNOWN'};
 });if(result.uncertain)throw new Error('Simulated uncertain provider response.');return{providerRefundId:result.providerRefundId};}
 async observe(request:RefundRequest):Promise<RefundObservation>{return this.transaction(request,async tx=>{const state=await tx.simulatedRefund.findFirstOrThrow({where:{refundId:request.id,storeId:request.storeId}});return{eventId:'sim_refund_'+request.id+'_'+state.version,status:state.status as RefundProviderStatus,providerRefundId:'sim_refund_'+request.id,amountMinor:state.amountMinor.toString(),currencyCode:state.currencyCode};});}
 async simulate(request:RefundRequest,status:RefundProviderStatus){await this.transaction(request,async tx=>{const state=await tx.simulatedRefund.findFirstOrThrow({where:{refundId:request.id,storeId:request.storeId}});if(state.status==='PROCESSED'||state.status===status)return;if(state.status==='FAILED'&&['PENDING','UNKNOWN'].includes(status))return;if(status!=='FAILED')await this.budget(tx,request);await tx.simulatedRefund.update({where:{refundId:request.id},data:{status,version:{increment:1}}});});}
}
