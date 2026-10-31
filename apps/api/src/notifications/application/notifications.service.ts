import {Logger} from '@nestjs/common';
import {IdentityError} from '../../identity/domain/identity.js';
import {moneyText,safeLine,type NotificationJob,type DeliveryOutcome,type MailMessage} from '../domain/notifications.js';
import type {NotificationRepositoryPort,NotificationTransportPort,NotificationCodecPort,NotificationLinksPort,NotificationSelector} from './notifications.port.js';
export class NotificationService {
  constructor(private repository:NotificationRepositoryPort,private transport:NotificationTransportPort,private codec:NotificationCodecPort,private links:NotificationLinksPort){}
  async close(){await this.transport.close?.();await this.repository.close?.();}
  async checkHealth(){if(process.env.DATA_DRIVER==='postgres')await this.repository.checkHealth();}
  private async message(job:NotificationJob):Promise<MailMessage|null>{
    if(job.source==='identity'){
      if(!job.encryptedPayload||!job.recipient)throw new Error('Invalid private notification.');
      const{token}=this.codec.decrypt(job.encryptedPayload);if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Invalid private notification.');
      const context=await this.repository.identityContext(job,this.codec.digest(token));if(!context)return null;
      const purpose=context.purpose==='VERIFY'?'Verify your email':context.purpose==='RESET'?'Reset your password':'Accept your merchant invitation';
      return{id:job.messageId,to:job.recipient,subject:purpose+' — Delcu',text:`Hello ${safeLine(context.name)||'there'},\n\n${purpose}:\n${this.links.identity(context,token)}\n\nThis link expires at ${context.expiresAt.toISOString()}. If you did not request it, you can ignore this message.\n\nDelcu`};
    }
    const order=await this.repository.orderContext(job);if(!order)return null;
    const subjects:Record<string,string>={ORDER_CONFIRMATION:'Order confirmed',ORDER_DISPATCHED:'Order dispatched',ORDER_DELIVERED:'Order delivered',ORDER_CANCELLED:'Order cancelled',PAYMENT_CONFIRMATION:'Payment recorded',REFUND_RECORDED:'Refund recorded'};
    const title=subjects[job.purpose];if(!title)throw new Error('Unsupported notification.');
    let detail=`Order: ${safeLine(order.number)}\nOrder total: ${moneyText(order.totalMinor,order.currencyCode)}\nPayment method: ${order.paymentMethod==='SIMULATOR'?'Development simulation':order.paymentMethod==='COD'?'Cash on delivery':'Online payment'}`;
    if(job.purpose==='PAYMENT_CONFIRMATION')detail+=`\nAmount recorded: ${moneyText(order.paidMinor,order.currencyCode)}`;
    if(job.purpose==='REFUND_RECORDED')detail+='\nRefunds recorded total: '+moneyText(order.refundedMinor,order.currencyCode);
    if(job.purpose==='ORDER_DISPATCHED')detail+=`${order.carrier?'\nCarrier: '+safeLine(order.carrier):''}${order.reference?'\nReference: '+safeLine(order.reference):''}`;
    return{id:job.messageId,to:order.recipient,subject:title+' '+safeLine(order.number)+' — Delcu',text:`Hello ${safeLine(order.name)||'there'},\n\n${title}.\n${detail}\n\nView your order:\n${this.links.order(order)}\n\nDelcu`};
  }
  async runOnce(limit=20,only?:NotificationSelector){
    if(process.env.DATA_DRIVER!=='postgres')throw new IdentityError(503,'Notification delivery requires PostgreSQL.');
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Notification batch must be 1–100.');
    const batch=await this.repository.claim(limit,this.transport.provider,this.transport.idempotent,only),result={processed:0,accepted:0,retried:0,failed:0,cancelled:0,unknown:batch.recoveredUnknown,finalizeFailed:0};
    const pending=[...batch.jobs];
    const deliver=async(job:NotificationJob)=>{
      result.processed++;let outcome:DeliveryOutcome;
      try{const message=await this.message(job);if(!message)outcome={kind:'cancelled',code:'STALE_SOURCE'};else{try{outcome=await this.transport.send(message);}catch{outcome={kind:'unknown',code:'DELIVERY_UNCERTAIN'};}}}
      catch{outcome={kind:'retryable',code:'SOURCE_UNAVAILABLE'};}
      try{await this.repository.finish(job,outcome);}catch{result.finalizeFailed++;Logger.error({event:'notification_finalize_failed',source:job.source},undefined,'Notifications');return;}
      if(outcome.kind==='accepted')result.accepted++;else if(outcome.kind==='retryable'&&job.attempts<5)result.retried++;else if(outcome.kind==='cancelled')result.cancelled++;else if(outcome.kind==='unknown')result.unknown++;else result.failed++;
    };
    await Promise.all(Array.from({length:Math.min(5,pending.length)},async()=>{for(let job;(job=pending.shift());)await deliver(job);}));
    return result;
  }
}
