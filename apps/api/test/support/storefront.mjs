import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {PrismaClient} from '../../dist/generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {decryptMail} from '../../dist/identity/infrastructure/secrets.js';
export const fixturePassword='isolated API fixture passphrase 981273';
export const fixtureAddress={name:'Shopper',line1:'12 Example Road',city:'Pune',region:'MH',postalCode:'411001',countryCode:'IN',phone:'+919999999999'};
export async function storefrontFixture(t){
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL required.');const previous=process.env.AUTH_OUTBOX_KEY;process.env.AUTH_OUTBOX_KEY='a'.repeat(64);
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
  const mediaDir=await mkdtemp(join(tmpdir(),'delcu-http-media-'));
  const keys=['browser','mutation'].map(kind=>createHash('sha256').update(`${kind}:127.0.0.1:${Math.floor(Date.now()/900000)}`).digest('hex'));let child,logs='';
  t.after(async()=>{try{if(child&&child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit'),timer=setTimeout(()=>child.kill('SIGKILL'),5000);timer.unref();child.kill('SIGTERM');const[,signal]=await exited;clearTimeout(timer);assert.notEqual(signal,'SIGKILL');}await db.identityThrottle.deleteMany({where:{key:{in:keys}}});}finally{await db.$disconnect();await rm(mediaDir,{recursive:true,force:true});if(previous===undefined)delete process.env.AUTH_OUTBOX_KEY;else process.env.AUTH_OUTBOX_KEY=previous;}});
  await db.identityThrottle.deleteMany({where:{key:{in:keys}}});
  const port=25000+Math.floor(Math.random()*2000),base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['dist/main.js'],{cwd:new URL('../../',import.meta.url),env:{...process.env,PORT:String(port),NODE_ENV:'development',DATA_DRIVER:'postgres',DEMO_AUTH_ENABLED:'false',OBJECT_STORAGE:'local',DEV_STORAGE_DIR:mediaDir,DEV_MAIL_DIR:join(mediaDir,'private-mail'),COMMERCE_WORKER_ENABLED:'false',NOTIFICATION_PROVIDER:'development'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',c=>{logs+=c;});child.stderr.on('data',c=>{logs+=c;});
  let ready=false;for(let i=0;i<100;i++){assert.equal(child.exitCode,null,logs);try{ready=(await fetch(base+'/health/ready')).ok;}catch{}if(ready)break;await delay(100);}assert.ok(ready,logs);
  async function request(browser,path,method='GET',body,extra={}){const response=await fetch(base+path,{method,headers:{cookie:browser.cookie??'',origin:'http://localhost:5173','x-csrf-token':browser.csrf??'','content-type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});const set=response.headers.get('set-cookie');if(set){const pair=set.split(';')[0],name=pair.split('=')[0];browser.cookie=[...(browser.cookie??'').split(';').map(c=>c.trim()).filter(c=>c&&!c.startsWith(name+'=')),...(!set.includes('Max-Age=0')?[pair]:[])].join('; ');}const text=await response.text(),result=text?JSON.parse(text):null;if(result?.csrfToken)browser.csrf=result.csrfToken;return{status:response.status,body:result};}
  async function register(handle){const browser={email:'journey-'+randomUUID()+'@example.test'},auth=handle?`/v1/storefront/${handle}/customer/auth`:'/v1/auth';assert.equal((await request(browser,auth+'/csrf')).status,200);assert.equal((await request(browser,auth+'/signup','POST',{email:browser.email,password:fixturePassword,name:'Shopper'})).status,201);const store=handle?await db.store.findUniqueOrThrow({where:{handle}}):null,scopeKey=store?'store:'+store.id:'merchant';const mail=await db.identityMail.findFirstOrThrow({where:{scopeKey,recipient:browser.email,purpose:'VERIFY'}});assert.equal((await request(browser,auth+'/verification/confirm','POST',{token:decryptMail(mail.encryptedPayload).token})).status,201);assert.equal((await request(browser,auth+'/login','POST',{email:browser.email,password:fixturePassword})).status,201);return browser;}
  async function store(owner,stock=2){
    const account=await request(owner,'/v1/merchant/accounts','POST',{name:'Journey merchant'});assert.equal(account.status,201);const handle='journey-'+randomUUID(),created=await request(owner,'/v1/merchant/stores','POST',{merchantId:account.body.id,name:'Journey store',handle,countryCode:'IN',currencyCode:'INR'},{'idempotency-key':randomUUID()});assert.equal(created.status,201);const id=created.body.id,path='/v1/merchant/stores/'+id;
    assert.equal((await request(owner,path+'/settings','PATCH',{expectedVersion:0,brandingName:'Journey brand',contactEmail:owner.email,timezone:'Asia/Kolkata'})).status,200);
    assert.equal((await request(owner,path+'/pricing','PUT',{version:0,shipping:[{id:'standard',name:'Standard shipping',countries:['IN'],rateMinor:'100',freeAboveMinor:'1000',active:true}],tax:{mode:'NONE',shippingTaxable:false,rates:[]},payments:{cod:true,simulator:false}})).status,200);
    assert.equal((await request(owner,path+'/onboarding/complete','POST',{expectedVersion:1})).status,201);
    const product=await request(owner,path+'/products','POST',{name:'Journey product',handle:'journey-product',priceMinor:'1000',variants:[{name:'One',sku:'JOURNEY-COUPON-1',stock}]});assert.equal(product.status,201);assert.equal((await request(owner,path+'/products/'+product.body.id+'/activate','POST',{})).status,201);assert.equal((await request(owner,path+'/publish','POST',{})).status,201);
    return{id,handle,path,root:'/v1/storefront/'+handle,variantId:product.body.variants[0].id,productId:product.body.id};
  }
  async function cart(browser,store,quantity=1){const created=await request(browser,store.root+'/cart','POST');assert.equal(created.status,201);const result=await request(browser,store.root+'/cart/items/'+store.variantId,'PUT',{expectedVersion:created.body.version,quantity});assert.equal(result.status,200);return result.body;}
  async function checkout(browser,store){const current=await request(browser,store.root+'/cart'),started=await request(browser,store.root+'/customer/checkouts','POST',{cartId:current.body.id,expectedCartVersion:current.body.version},{'idempotency-key':randomUUID()});assert.equal(started.status,201,JSON.stringify(started.body));const path=store.root+'/customer/checkouts/'+started.body.id;const configured=await request(browser,path,'PATCH',{expectedVersion:0,shippingAddress:fixtureAddress,shippingMethodId:'standard'});assert.equal(configured.status,200);return{path,id:started.body.id,version:configured.body.version};}
  return{db,request,register,store,cart,checkout,base,logs:()=>logs};
}
