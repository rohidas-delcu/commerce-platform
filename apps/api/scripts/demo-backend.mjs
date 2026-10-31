// Real HTTP journey; isolated, disposable data. No test-only authentication shortcuts.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {config} from 'dotenv';
import pg from 'pg';
import sharp from 'sharp';

if(process.env.NODE_ENV==='production')throw new Error('Development demonstration refuses production.');
const root=fileURLToPath(new URL('../../../',import.meta.url)),api=fileURLToPath(new URL('../',import.meta.url));
config({path:join(api,'.env'),quiet:true});
if(process.env.NODE_ENV==='production')throw new Error('Development demonstration refuses production configuration.');
const verify=process.argv.includes('--verify-and-exit');
if(process.argv.slice(2).some(arg=>arg!=='--verify-and-exit'))throw new Error('Supported option: --verify-and-exit');
const original=new URL(process.env.DATABASE_URL??'postgresql://commerce:commerce@127.0.0.1:5432/commerce');
if(!['postgres:','postgresql:'].includes(original.protocol)||!['127.0.0.1','localhost','[::1]'].includes(original.hostname))throw new Error('Demo requires a loopback PostgreSQL server with CREATE DATABASE privileges.');
const name='delcu_demo_'+randomUUID().replaceAll('-',''),database=new URL(original);database.pathname='/'+name;database.searchParams.set('schema','public');
const adminUrl=new URL(original);adminUrl.pathname='/postgres';adminUrl.search='';
const privateDir=await mkdtemp(join(tmpdir(),'delcu-backend-demo-')),mailDir=join(privateDir,'mail');
await mkdir(mailDir,{mode:0o700});
const password=randomBytes(24).toString('base64url'),outboxKey=randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'development',DATA_DRIVER:'postgres',DATABASE_URL:database.toString(),DEMO_AUTH_ENABLED:'false',AUTH_OUTBOX_KEY:outboxKey,OBJECT_STORAGE:'local',DEV_STORAGE_DIR:join(privateDir,'media'),DEV_MAIL_DIR:mailDir,NOTIFICATION_PROVIDER:'development',COMMERCE_WORKER_ENABLED:'true',CORS_ORIGINS:'http://localhost:5173',MERCHANT_APP_URL:'http://localhost:5173',STOREFRONT_APP_URL:'http://localhost:5173'};
let admin,created=false,child,childLogs='',stopRequested=false,resolveStop;
const stopped=new Promise(resolve=>{resolveStop=resolve;});
const stop=()=>{stopRequested=true;resolveStop();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
async function command(binary,args,cwd=root){
  const job=spawn(binary,args,{cwd,env,stdio:['ignore','pipe','pipe']});let output='';job.stdout.on('data',c=>{output+=c;});job.stderr.on('data',c=>{output+=c;});
  const [code]=await once(job,'exit');
  if(code!==0){await writeFile(join(privateDir,'command-error.log'),output,{mode:0o600});throw new Error('Demo setup command failed; private diagnostic file: '+join(privateDir,'command-error.log'));}
  return output;
}
async function connectAdmin(){const connection=new pg.Client({connectionString:adminUrl.toString(),connectionTimeoutMillis:2000});try{await connection.connect();return connection;}catch{await connection.end().catch(()=>{});throw new Error('PostgreSQL is unavailable.');}}
async function startPostgres(){
  try{return await connectAdmin();}catch{}
  // Only provision the documented local development credentials; never alter a DB.
  if(original.username!=='commerce'||original.password!=='commerce')throw new Error('Start your configured local PostgreSQL server, then rerun the demo.');
  const databasePort=original.port||'5432',container='delcu-backend-demo-postgres-'+databasePort;let exists=true;
  try{await command('docker',['inspect',container]);}catch{exists=false;}
  if(exists)await command('docker',['start',container]);
  else await command('docker',['run','-d','--name',container,'-p',`127.0.0.1:${databasePort}:5432`,'-e','POSTGRES_USER=commerce','-e','POSTGRES_PASSWORD=commerce','-e','POSTGRES_DB=commerce','postgres:17-alpine']);
  for(let i=0;i<100;i++){try{return await connectAdmin();}catch{}await delay(200);}
  throw new Error('Local PostgreSQL did not become ready. Existing databases were not changed.');
}
async function freePort(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address==='object');const port=address.port;await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));return port;}

try{
  admin=await startPostgres();await admin.query(`CREATE DATABASE "${name}"`);created=true;
  await command('pnpm',['db:deploy']);await command('pnpm',['db:deploy']);await command('pnpm',['db:status']);await command('pnpm',['db:drift']);
  env.PORT=String(await freePort());const base='http://127.0.0.1:'+env.PORT;
  child=spawn(process.execPath,['dist/main.js'],{cwd:api,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',c=>{childLogs+=c;});child.stderr.on('data',c=>{childLogs+=c;});
  let ready=false;for(let i=0;i<150;i++){if(child.exitCode!==null)throw new Error('Demo API startup failed.');try{ready=(await fetch(base+'/health/ready',{signal:AbortSignal.timeout(2000)})).ok;}catch{}if(ready)break;await delay(100);}assert.ok(ready,'API readiness');
  async function request(browser,path,method='GET',body,expected=method==='POST'?201:200,headers={}){
    if(stopRequested)throw new Error('Demo interrupted.');
    const response=await fetch(base+path,{method,headers:{cookie:browser.cookie??'',origin:'http://localhost:5173','x-csrf-token':browser.csrf??'','content-type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    for(const set of response.headers.getSetCookie()){const pair=set.split(';')[0],cookieName=pair.split('=')[0];browser.cookie=[...(browser.cookie??'').split(';').map(c=>c.trim()).filter(c=>c&&!c.startsWith(cookieName+'=')),...(!set.includes('Max-Age=0')?[pair]:[])].join('; ');}
    // Errors omit request bodies, response payloads and bearer credentials.
    assert.equal(response.status,expected,`${method} ${path} returned ${response.status}`);
    const result=await response.json();if(result?.csrfToken)browser.csrf=result.csrfToken;return result;
  }
  async function deliveredVerification(email){
    for(let i=0;i<150;i++){
      for(const filename of (await readdir(mailDir)).filter(f=>f.startsWith('identity_')&&f.endsWith('.json'))){const message=JSON.parse(await readFile(join(mailDir,filename),'utf8'));if(message.to!==email)continue;const link=message.text.match(/http:\/\/localhost:5173\/\S+/)?.[0];if(link){const token=new URL(link).searchParams.get('token');if(token)return token;}}
      await delay(100);
    }
    throw new Error('Development mail worker did not deliver verification.');
  }
  async function register(browser,email,auth){
    await request(browser,auth+'/csrf');await request(browser,auth+'/signup','POST',{email,password,name:auth==='/v1/auth'?'Demo Merchant':'Demo Customer'});
    await request(browser,auth+'/verification/confirm','POST',{token:await deliveredVerification(email)});
    await request(browser,auth+'/login','POST',{email,password});
  }
  const owner={};await register(owner,'merchant@example.test','/v1/auth');
  const account=await request(owner,'/v1/merchant/accounts','POST',{name:'Delcu demonstration merchant'});
  const store=await request(owner,'/v1/merchant/stores','POST',{merchantId:account.id,name:'Delcu Trail Supply',handle:'delcu-trail-supply',countryCode:'IN',currencyCode:'INR'},201,{'idempotency-key':'demo-store-create-v1'}),path='/v1/merchant/stores/'+store.id,storefront='/v1/storefront/'+store.handle;
  await request(owner,path+'/settings','PATCH',{expectedVersion:0,brandingName:'Delcu Trail Supply',contactEmail:'merchant@example.test',timezone:'Asia/Kolkata'});
  await request(owner,path+'/pricing','PUT',{version:0,shipping:[{id:'standard',name:'Standard shipping',countries:['IN'],rateMinor:'9900',freeAboveMinor:'250000',active:true}],tax:{mode:'NONE',shippingTaxable:false,rates:[]},payments:{cod:true,simulator:true}});
  const catalog=[];
  for(const [index,item] of [
    {name:'Everyday Trail Backpack',handle:'trail-backpack',description:'Durable 22-litre daypack for everyday journeys.',priceMinor:'199900',variants:[{name:'Forest',sku:'TRAIL-BAG-FOREST',stock:12,options:{colour:'Forest'}},{name:'Sand',sku:'TRAIL-BAG-SAND',stock:8,options:{colour:'Sand'}}],colour:'#426b4b'},
    {name:'Insulated Travel Bottle',handle:'travel-bottle',description:'Reusable 750ml insulated bottle.',priceMinor:'79900',variants:[{name:'Slate',sku:'TRAIL-BOTTLE-SLATE',stock:20}],colour:'#526678'}
  ].entries()){
    const {colour,...input}=item,product=await request(owner,path+'/products','POST',input);
    const image=await sharp(Buffer.from(`<svg width="320" height="240" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="240" fill="#f4f0e7"/><rect x="100" y="40" width="120" height="160" rx="25" fill="${colour}"/></svg>`)).png().toBuffer();
    const upload=await request(owner,path+'/media/reservations','POST',{contentType:'image/png',size:image.length,checksum:createHash('sha256').update(image).digest('hex')});
    const uploaded=await fetch(base+upload.upload.url,{method:'PUT',headers:upload.upload.headers,body:image,signal:AbortSignal.timeout(10000)});assert.equal(uploaded.status,200);
    await request(owner,path+'/media/'+upload.assetId+'/complete','POST',{});
    await request(owner,path+'/products/'+product.id+'/images','PUT',{expectedVersion:0,assetIds:[upload.assetId],primaryAssetId:upload.assetId,altTexts:{[upload.assetId]:item.name+' demonstration illustration'}});
    await request(owner,path+'/products/'+product.id+'/activate','POST',{});catalog.push(product);
    if(index===0)await request(owner,path+'/settings','PATCH',{expectedVersion:1,logoAssetId:upload.assetId});
  }
  let collection=await request(owner,path+'/collections','POST',{name:'Trail essentials',handle:'trail-essentials',featured:true,position:0});
  for(const [position,product] of catalog.entries())collection=await request(owner,path+'/collections/'+collection.id+'/products/'+product.id,'PUT',{expectedVersion:collection.version,position});
  const settings=await request(owner,path);await request(owner,path+'/onboarding/complete','POST',{expectedVersion:settings.settingsVersion});await request(owner,path+'/publish','POST',{});
  console.log('PASS: merchant signup, delivered verification, onboarding, catalog, verified images, collection and publication.');
  const publicCollections=await request({},storefront+'/collections');assert.equal(publicCollections.collections.length,1);
  const publicProducts=await request({},storefront+'/collections/trail-essentials');assert.equal(publicProducts.products.length,2);
  const customer={},auth=storefront+'/customer/auth';await request(customer,auth+'/csrf');
  let cart=await request(customer,storefront+'/cart','POST');const variant=catalog[0].variants[0];cart=await request(customer,storefront+'/cart/items/'+variant.id,'PUT',{expectedVersion:cart.version,quantity:1});const guestVersion=cart.version;
  await register(customer,'customer@example.test',auth);const owned=await request(customer,storefront+'/cart','POST');cart=await request(customer,storefront+'/cart/merge','POST',{expectedVersion:owned.version,guestVersion});assert.equal(cart.items[0].quantity,1);
  const address={name:'Demo Customer',line1:'12 Example Road',city:'Pune',region:'Maharashtra',postalCode:'411001',countryCode:'IN',phone:'+919999999999'};
  const savedAddress=await request(customer,storefront+'/customer/addresses','POST',address);assert.equal(savedAddress.isDefault,true);
  let checkout=await request(customer,storefront+'/customer/checkouts','POST',{cartId:cart.id,expectedCartVersion:cart.version},201,{'idempotency-key':'demo-checkout-v1'}),checkoutPath=storefront+'/customer/checkouts/'+checkout.id;
  checkout=await request(customer,checkoutPath,'PATCH',{expectedVersion:checkout.version,shippingAddress:address,billingSameAsShipping:true,shippingMethodId:'standard'});
  checkout=await request(customer,checkoutPath+'/reserve','POST',{expectedVersion:checkout.version});assert.equal(checkout.snapshot.totals.totalMinor,'209800');
  const payment=await request(customer,checkoutPath+'/payments','POST',{expectedVersion:checkout.version,method:'SIMULATOR',scenario:'SUCCESS'},201,{'idempotency-key':'demo-payment-v1'});assert.equal(payment.status,'SUCCEEDED');
  const paymentRetry=await request(customer,checkoutPath+'/payments','POST',{expectedVersion:checkout.version,method:'SIMULATOR',scenario:'SUCCESS'},201,{'idempotency-key':'demo-payment-v1'});assert.equal(paymentRetry.orderId,payment.orderId);
  let order=await request(owner,path+'/orders/'+payment.orderId);assert.equal(order.paymentStatus,'PAID');assert.equal(order.billingAddressSource,'SHIPPING_DEFAULT');
  for(const action of ['ready','dispatch','deliver'])order=await request(owner,path+'/orders/'+order.id+'/'+action,'POST',{expectedVersion:order.version,key:'demo-'+action+'-v1',...(action==='dispatch'?{carrier:'Manual demo carrier',reference:'DEMO-TRACK-001'}:{})});
  assert.equal(order.status,'COMPLETED');assert.equal(order.fulfillmentStatus,'DELIVERED');assert.equal(order.paidMinor,'209800');assert.equal(order.amountDueMinor,'0');
  const history=await request(customer,storefront+'/customer/orders');assert.equal(history.items.length,1);assert.equal(history.items[0].id,order.id);
  const customerOrder=await request(customer,storefront+'/customer/orders/'+order.id);assert.equal('sku'in customerOrder.items[0],false);assert.equal(customerOrder.events.some(e=>e.kind==='DELIVER'),true);
  const finalProduct=await request(owner,path+'/products/'+catalog[0].id);assert.equal(finalProduct.variants[0].stock,11);assert.equal(finalProduct.variants[0].reserved,0);
  let deliveredMail=0;for(let i=0;i<100;i++){deliveredMail=(await readdir(mailDir)).filter(f=>f.startsWith('order_')).length;if(deliveredMail>=4)break;await delay(100);}assert.ok(deliveredMail>=4,'Order/payment/dispatch/delivery mail accepted locally');
  const spec=await fetch(base+'/docs-json');assert.equal(spec.status,200);assert.ok((await spec.json()).paths[checkoutPath.replace(checkout.id,'{checkoutId}').replace(store.handle,'{handle}')]);
  assert.ok(!childLogs.includes(password)&&!childLogs.includes(outboxKey),'No password/key in logs');
  console.log('PASS: public discovery, guest cart/login merge, saved address, billing, simulated payment/retry, one order, fulfillment, delivery, private history, inventory and local notifications.');
  console.log(JSON.stringify({mode:'development simulation; no real payment',storefront:base+storefront,openapi:base+'/docs',orderNumber:order.number,totalMinor:order.totalMinor,currencyCode:order.currencyCode}));
  if(!verify){await writeFile(join(privateDir,'credentials.json'),JSON.stringify({merchantEmail:'merchant@example.test',customerEmail:'customer@example.test',password,storeHandle:store.handle},null,2),{mode:0o600});console.log('Demo running. Private local credentials: '+join(privateDir,'credentials.json')+'. Ctrl+C shuts down and removes only this demo database/files.');await stopped;}
}catch(error){
  // Diagnostics remain private; never dump HTTP payloads, tokens or DB URLs.
  await writeFile(join(privateDir,'api.log'),childLogs,{mode:0o600});
  console.error('Demo failed: '+(error instanceof Error?error.message:'unknown error'));process.exitCode=1;
}finally{
  if(child&&child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit'),timer=setTimeout(()=>child.kill('SIGKILL'),15000);timer.unref();child.kill('SIGTERM');const[,signal]=await exited;clearTimeout(timer);if(signal==='SIGKILL'){console.error('Demo shutdown exceeded grace period.');process.exitCode=1;}}
  if(created)await admin.query(`DROP DATABASE "${name}"`);
  await admin?.end();
  if(process.exitCode!==1)await rm(privateDir,{recursive:true,force:true});
  else console.error('Private diagnostics retained at '+privateDir);
  process.off('SIGINT',stop);process.off('SIGTERM',stop);
  console.log('Demo API stopped; owned disposable database removed. Existing data preserved.');
}
