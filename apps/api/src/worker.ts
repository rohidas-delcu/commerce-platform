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
  if(args.length){if(args.length!==2||!['identity','order'].includes(args[0])||!/^[a-f0-9-]{36}$/i.test(args[1]))throw new Error('Expected optional source and notification UUID.');only={source:args[0] as NotificationSelector['source'],id:args[1]};}
  const app=await NestFactory.createApplicationContext(AppModule,{logger:false,abortOnError:false});
  try{console.log(JSON.stringify({event:'notification_batch',...await app.get(NotificationService).runOnce(20,only)}));}finally{await app.close();}
}
main().catch(()=>{console.error(JSON.stringify({event:'notification_worker_failed'}));process.exitCode=1;});
