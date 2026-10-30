import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm,readFile,stat,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {moneyText,retryDelayMs,safeLine} from '../src/notifications/domain/notifications.ts';
import {DevelopmentMailer} from '../src/notifications/infrastructure/development-mailer.ts';
import {SesMailer} from '../src/notifications/infrastructure/ses-mailer.ts';
import {ConfiguredNotificationLinks} from '../src/notifications/infrastructure/links.ts';
import {NotificationService} from '../src/notifications/application/notifications.service.ts';
test('notification money, safe text and application routes preserve exact values',()=>{
 assert.equal(moneyText('9007199254740993','INR'),'INR 90071992547409.93');assert.equal(retryDelayMs(1),30000);assert.equal(retryDelayMs(100),3600000);assert.equal(safeLine('A\nB\r\0'),'A B');
 assert.throws(()=>moneyText('-1','INR'));assert.throws(()=>moneyText('10','JPY'));assert.throws(()=>new ConfiguredNotificationLinks('javascript:alert(1)'));
 const links=new ConfiguredNotificationLinks('https://admin.example.test/','https://shop.example.test/');const context={purpose:'VERIFY',audience:'customer',storeHandle:'shop',name:'Person',expiresAt:new Date()};const url=new URL(links.identity(context,'not-a-real-token'));assert.equal(url.pathname,'/stores/shop/verify-email');assert.equal(url.searchParams.get('token'),'not-a-real-token');
});
test('private development mailbox deduplicates stable identity and rejects production',async()=>{
 const root=await mkdtemp(join(tmpdir(),'delcu-mail-unit-'));try{const transport=new DevelopmentMailer(root),message={id:'identity_'+randomUUID(),to:'fixture@example.test',subject:'Fixture',text:'Private fixture only'};
 const results=await Promise.all([transport.send(message),transport.send(message)]);assert.ok(results.every(x=>x.kind==='accepted'));assert.deepEqual(await readdir(root),[message.id+'.json']);assert.deepEqual(JSON.parse(await readFile(join(root,message.id+'.json'),'utf8')),message);assert.equal((await stat(join(root,message.id+'.json'))).mode&0o777,0o600);
 assert.equal((await transport.send({...message,to:'different@example.test'})).kind,'rejected');assert.equal((await transport.send({...message,id:'../../escape'})).kind,'rejected');
 const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';try{assert.throws(()=>new DevelopmentMailer(root));}finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
 }finally{await rm(root,{recursive:true,force:true});}
});
test('SES adapter boundary fake: accepted is not delivered; unknown results never become retryable',async()=>{
 let command;const client={send:async input=>{command=input;return{MessageId:'fake-provider-receipt'};}};const transport=new SesMailer(client,'sender@example.test');const message={id:'order_'+randomUUID(),to:'fixture@example.test',subject:'Fixture',text:'Fixture only'};
 assert.equal(transport.idempotent,false);assert.deepEqual(await transport.send(message),{kind:'accepted',providerMessageId:'fake-provider-receipt'});assert.equal(command.input.Destination.ToAddresses[0],message.to);assert.equal(command.input.EmailTags[0].Value,message.id);
 for(const[name,kind]of[['TooManyRequestsException','retryable'],['AccountSuspendedException','rejected'],['TimeoutError','unknown'],['InternalFailure','unknown']]){client.send=async()=>{throw Object.assign(new Error('not logged'),{name});};assert.equal((await transport.send(message)).kind,kind);}
 client.send=async()=>({});assert.equal((await transport.send(message)).kind,'unknown');
});
test('notification orchestration isolates transport failure from durable business state',async()=>{
 const previous=process.env.DATA_DRIVER;process.env.DATA_DRIVER='postgres';try{
 const job={source:'order',id:randomUUID(),leaseToken:randomUUID(),purpose:'ORDER_CONFIRMATION',messageId:'order_'+randomUUID(),attempts:1};let outcome;
 const repository={claim:async()=>({jobs:[job],recoveredUnknown:0}),orderContext:async()=>({recipient:'fixture@example.test',name:'Shopper',handle:'shop',number:'ORD-1',orderId:randomUUID(),currencyCode:'INR',totalMinor:'1000',paidMinor:'0',paymentMethod:'COD'}),finish:async(_job,result)=>{outcome=result;return true;}};
 const service=new NotificationService(repository,{provider:'fake',idempotent:false,send:async()=>{throw new Error('network uncertain');}},{},new ConfiguredNotificationLinks());assert.equal((await service.runOnce()).unknown,1);assert.equal(outcome.kind,'unknown');repository.orderContext=async()=>null;assert.equal((await service.runOnce()).cancelled,1);
 }finally{if(previous===undefined)delete process.env.DATA_DRIVER;else process.env.DATA_DRIVER=previous;}
});

test('notification worker validates configuration, waits for active delivery before closing resources and refuses SES fallback',async()=>{
 const {NotificationWorker,notificationTransport}=await import('../src/notifications/notifications.module.ts');
 const previous={...process.env};let release,started=false,closed=false,calls=0;try{
 process.env.DATA_DRIVER='postgres';process.env.COMMERCE_WORKER_ENABLED='true';
 const active=new Promise(resolve=>{release=resolve;}),worker=new NotificationWorker({runOnce:async()=>{calls++;started=true;await active;},close:async()=>{closed=true;}});worker.onModuleInit();await new Promise(resolve=>setTimeout(resolve,1100));assert.equal(started,true);const shutdown=worker.onModuleDestroy();assert.equal(closed,false);release();await shutdown;assert.equal(closed,true);assert.equal(calls,1);
 process.env.NOTIFICATION_PROVIDER='ses';delete process.env.SES_REGION;assert.throws(()=>notificationTransport(),/SES requires/);
 process.env.SES_REGION='us-east-1';process.env.SES_FROM_EMAIL='fixture@example.test';process.env.MERCHANT_APP_URL='http://localhost:5173';process.env.STOREFRONT_APP_URL='https://shop.example.test';assert.throws(()=>notificationTransport(),/HTTPS/);
 process.env.NOTIFICATION_PROVIDER='unknown';assert.throws(()=>notificationTransport(),/Unknown/);
 }finally{for(const key of ['DATA_DRIVER','COMMERCE_WORKER_ENABLED','NOTIFICATION_PROVIDER','SES_REGION','SES_FROM_EMAIL','MERCHANT_APP_URL','STOREFRONT_APP_URL'])if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});
