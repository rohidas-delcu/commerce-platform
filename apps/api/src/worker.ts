import {RefundService} from './refunds/application/refunds.service.js';
import {PaymentService} from './payments/application/payments.service.js';
import {MaintenanceService} from './operations/application/maintenance.service.js';
import 'reflect-metadata';
import 'dotenv/config';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module.js';
import {readRuntimeConfig} from './config/runtime.js';
import {NotificationService} from './notifications/application/notifications.service.js';
import type {NotificationSelector} from './notifications/application/notifications.port.js';
// Trusted CLI only. Never expose delivery or the private mailbox through HTTP.
async function main(){
  readRuntimeConfig();process.env.COMMERCE_WORKER_ENABLED='false';
  const args=process.argv.slice(2);let only:NotificationSelector|undefined;
  const maintenance=args[0]==='maintenance',payments=args[0]==='payments',refunds=args[0]==='refunds';
  if(maintenance||payments||refunds){if(args.length>2)throw new Error('Expected optional store UUID.');}
  else if(args.length){if(args.length!==2||!['identity','order','payment'].includes(args[0])||!/^[a-f0-9-]{36}$/i.test(args[1]))throw new Error('Expected optional source and notification UUID.');only={source:args[0] as NotificationSelector['source'],id:args[1]};}
  const app=await NestFactory.createApplicationContext(AppModule,{logger:false,abortOnError:false});
  try{const result=refunds?await app.get(RefundService).runOnce(20,args[1]):payments?await app.get(PaymentService).runOnce(20,args[1]):maintenance?await app.get(MaintenanceService).runOnce(50,args[1]):await app.get(NotificationService).runOnce(20,only);console.log(JSON.stringify({event:refunds?'refund_reconciliation_batch':payments?'payment_reconciliation_batch':maintenance?'commerce_expiry_batch':'notification_batch',...result}));if(result.failed>0||('finalizeFailed'in result&&result.finalizeFailed>0)||('unknown'in result&&result.unknown>0))process.exitCode=1;}finally{await app.close();}
}
main().catch(()=>{console.error(JSON.stringify({event:'notification_worker_failed'}));process.exitCode=1;});
