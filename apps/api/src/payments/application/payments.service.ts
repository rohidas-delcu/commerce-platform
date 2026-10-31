import {Logger} from '@nestjs/common';
import {DomainError} from '../../domain/commerce.js';
import type {CheckoutContext} from '../../checkout/application/checkout.port.js';
import {paymentKey,simulationInput,assertDevelopmentPayment,paymentProjection,type PaymentAttempt,type ProviderStatus,type SimulationScenario} from '../domain/payments.js';
import type {PaymentRepositoryPort,PaymentPort,DevelopmentPaymentPort} from './payments.port.js';
export class PaymentService {
 constructor(private repository:PaymentRepositoryPort,private provider:PaymentPort,private simulator?:DevelopmentPaymentPort){}
 async checkHealth(){if(process.env.DATA_DRIVER==='postgres'){await this.repository.checkHealth();await this.provider.checkHealth?.();}}
 async close(){await this.provider.close?.();await this.repository.close();}
 private enabled(){if(process.env.DATA_DRIVER!=='postgres')throw new DomainError('CONFLICT','Payments require PostgreSQL.');if(this.provider.method!=='SIMULATOR')throw new DomainError('CONFLICT','Online provider activation is disabled.');assertDevelopmentPayment();}
 private async synchronize(row:PaymentAttempt):Promise<PaymentAttempt>{
  this.enabled();if(row.method!==this.provider.method)throw new DomainError('CONFLICT','Payment provider is unavailable.');
  if(['SUCCEEDED','REVIEW_REQUIRED','REFUNDED'].includes(row.status))return row;
  if(!row.providerOrderId){
   if(!this.provider.idempotentCreation&&row.status!=='INITIATING')return row;
   try{row=await this.repository.attach(row.id,(await this.provider.create(row)).providerOrderId);}catch{return this.repository.unknown(row.id);}
  }
  let observation;try{observation=await this.provider.observe(row);}catch{return this.repository.unknown(row.id);}
  row=await this.repository.record(row.id,observation);
  if(row.status==='CAPTURED'){
   try{return await this.repository.finalize(row.id);}catch(error){if(error instanceof DomainError)return this.repository.review(row.id,'ORDER_FINALIZATION_CONFLICT');throw error;}
  }return row;
 }
 async start(c:CheckoutContext,checkoutId:string,version:number,key:string,scenario:SimulationScenario='MANUAL',delaySeconds=2){this.enabled();paymentKey(key);const input=simulationInput(scenario,delaySeconds),row=await this.repository.prepare(c,checkoutId,version,key,input.scenario,input.delaySeconds);return paymentProjection(await this.synchronize(row));}
 async get(c:CheckoutContext,id:string){this.enabled();return paymentProjection(await this.repository.owned(c,id));}
 async reconcile(c:CheckoutContext,id:string){this.enabled();return paymentProjection(await this.synchronize(await this.repository.owned(c,id)));}
 async simulate(c:CheckoutContext,id:string,key:string,event:ProviderStatus){this.enabled();paymentKey(key);if(!['PENDING','CAPTURED','FAILED','UNKNOWN'].includes(event))throw new DomainError('INVALID','Invalid simulator event.');const row=await this.repository.owned(c,id);if(row.method!=='SIMULATOR'||!this.simulator)throw new DomainError('FORBIDDEN','Not a development payment.');await this.simulator.simulate(row,key,event);return paymentProjection(await this.synchronize(await this.repository.find(id)??row));}
 async runOnce(limit=20,storeId?:string){this.enabled();if(!Number.isInteger(limit)||limit<1||limit>100||storeId!==undefined&&!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(storeId))throw new Error('Invalid payment reconciliation batch.');const ids=await this.repository.due(limit,storeId),result={processed:0,succeeded:0,review:0,pending:0,declined:0,failed:0};for(const id of ids){try{const row=await this.repository.find(id);if(!row)continue;const current=await this.synchronize(row);result.processed++;if(current.status==='SUCCEEDED')result.succeeded++;else if(current.status==='REVIEW_REQUIRED')result.review++;else if(current.status==='FAILED')result.declined++;else result.pending++;}catch{result.failed++;Logger.error({event:'payment_reconciliation_failed'},undefined,'Payments');}}return result;}
}
