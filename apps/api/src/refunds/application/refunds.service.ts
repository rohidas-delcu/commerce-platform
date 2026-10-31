import {Logger} from '@nestjs/common';
import {DomainError} from '../../domain/commerce.js';
import {assertDevelopmentPayment} from '../../payments/domain/payments.js';
import {refundProjection,type RefundProviderStatus} from '../domain/refunds.js';
import type {RefundProcessingPort,RefundProviderPort,DevelopmentRefundPort} from './refunds.port.js';
export class RefundService {
 constructor(private repository:RefundProcessingPort,private provider:RefundProviderPort,private simulator?:DevelopmentRefundPort){}
 async checkHealth(){if(process.env.DATA_DRIVER==='postgres')await this.repository.checkHealth();}
 async close(){await this.provider.close?.();await this.repository.close();}
 async process(id:string,observeFailed=false){if(process.env.DATA_DRIVER!=='postgres')throw new DomainError('CONFLICT','Refund processing requires PostgreSQL.');assertDevelopmentPayment();let row=await this.repository.request(id);if(['SUCCEEDED','REVIEW_REQUIRED'].includes(row.status)||row.status==='FAILED'&&!observeFailed)return row;
  if(row.method!==this.provider.method)throw new DomainError('CONFLICT','Refund provider unavailable.');
  if(!row.providerRefundId){if(!this.provider.idempotentCreation&&row.status!=='CREATED')return row;try{await this.repository.attach(id,(await this.provider.create(row)).providerRefundId);}catch{return this.repository.unknown(id);}row=await this.repository.request(id);}
  let observed;try{observed=await this.provider.observe(row);}catch{return this.repository.unknown(id);}const result=await this.repository.record(id,observed);if(result.status!=='CONFIRMED')return result;try{return await this.repository.finalize(id);}catch(error){if(error instanceof DomainError)return this.repository.review(id,'REFUND_FINALIZATION_CONFLICT');throw error;}
 }
 async simulate(id:string,status:RefundProviderStatus){assertDevelopmentPayment();if(!this.simulator||!['PROCESSED','FAILED','PENDING','UNKNOWN'].includes(status))throw new DomainError('INVALID','Invalid development refund event.');const row=await this.repository.request(id);await this.simulator.simulate(row,status);return this.process(id,true);}
 async runOnce(limit=20,storeId?:string){assertDevelopmentPayment();if(process.env.DATA_DRIVER!=='postgres'||!Number.isInteger(limit)||limit<1||limit>100||storeId!==undefined&&!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(storeId))throw new Error('Invalid refund reconciliation batch.');const result={processed:0,succeeded:0,pending:0,declined:0,review:0,failed:0};for(const id of await this.repository.due(limit,storeId)){try{const row=await this.process(id);result.processed++;if(row.status==='SUCCEEDED')result.succeeded++;else if(row.status==='FAILED')result.declined++;else if(row.status==='REVIEW_REQUIRED')result.review++;else result.pending++;}catch{result.failed++;Logger.error({event:'refund_reconciliation_failed'},undefined,'Refunds');}}return result;}
}
