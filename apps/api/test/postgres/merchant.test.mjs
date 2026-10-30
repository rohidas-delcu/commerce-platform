import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {PrismaClient} from '../../dist/generated/prisma/client.js';
import pg from 'pg';
import sharp from 'sharp';
import {PrismaPg} from '@prisma/adapter-pg';
import {decryptMail} from '../../dist/identity/infrastructure/secrets.js';

test('merchant accounts, resumable onboarding, scoped roles, invitations, revocation and publication', {timeout:60000}, async t=>{
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL required.');
  const previous=process.env.AUTH_OUTBOX_KEY; process.env.AUTH_OUTBOX_KEY='d'.repeat(64);
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
  const limiterKeys=['browser','mutation'].map(kind=>createHash('sha256').update(`${kind}:127.0.0.1:${Math.floor(Date.now()/900000)}`).digest('hex'));
  await db.identityThrottle.deleteMany({where:{key:{in:limiterKeys}}});
  const port=22000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['dist/main.js'],{cwd:new URL('../../',import.meta.url),env:{...process.env, COMMERCE_WORKER_ENABLED: 'false', NOTIFICATION_PROVIDER: 'development',PORT:String(port),NODE_ENV:'development',DATA_DRIVER:'postgres',DEMO_AUTH_ENABLED:'true'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',b=>{logs+=b;});child.stderr.on('data',b=>{logs+=b;});
  t.after(async()=>{
    if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit'),timer=setTimeout(()=>child.kill('SIGKILL'),5000);timer.unref();child.kill('SIGTERM');const[,signal]=await exited;clearTimeout(timer);assert.notEqual(signal,'SIGKILL');}
    await db.identityThrottle.deleteMany({where:{key:{in:limiterKeys}}});
    await db.$disconnect();if(previous===undefined)delete process.env.AUTH_OUTBOX_KEY;else process.env.AUTH_OUTBOX_KEY=previous;
  });
  let ready=false;for(let i=0;i<100;i++){assert.equal(child.exitCode,null,logs);try{ready=(await fetch(base+'/health/ready')).ok;}catch{}if(ready)break;await delay(100);}assert.ok(ready,logs);
  async function request(b,path,method='GET',body,extra={}){
    const response=await fetch(base+path,{method,headers:{cookie:b.cookie??'',origin:'http://localhost:5173','x-csrf-token':b.csrf??'','content-type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});
    const cookie=response.headers.get('set-cookie');if(cookie)b.cookie=cookie.split(';')[0];const text=await response.text();const result=text?JSON.parse(text):null;if(result?.csrfToken)b.csrf=result.csrfToken;
    return{status:response.status,body:result};
  }
  const password='long unique merchant fixture password 93481';
  async function register(){const b={email:`merchant-${randomUUID()}@example.test`};await request(b,'/v1/auth/csrf');assert.equal((await request(b,'/v1/auth/signup','POST',{email:b.email,password,name:'Merchant fixture'})).status,201);const mail=await db.identityMail.findFirstOrThrow({where:{recipient:b.email,purpose:'VERIFY'}});assert.equal((await request(b,'/v1/auth/verification/confirm','POST',{token:decryptMail(mail.encryptedPayload).token})).status,201);assert.equal((await request(b,'/v1/auth/login','POST',{email:b.email,password})).status,201);b.id=(await request(b,'/v1/auth/me')).body.id;return b;}
  const owner=await register(),staff=await register(),stranger=await register();
  const root='/v1/merchant';
  const account=await request(owner,root+'/accounts','POST',{name:'Owner business'});assert.equal(account.status,201);
  const merchantId=account.body.id,handle=`journey-${randomUUID()}`,input={merchantId,name:'Journey store',handle,countryCode:'IN',currencyCode:'INR'},key=randomUUID();
  const created=await request(owner,root+'/stores','POST',input,{'idempotency-key':key});assert.equal(created.status,201,JSON.stringify(created.body));const storeId=created.body.id,path=`${root}/stores/${storeId}`;
  assert.equal((await request(owner,root+'/stores','POST',input,{'idempotency-key':key})).body.id,storeId);
  assert.equal((await request(owner,root+'/stores','POST',{...input,name:'Different'},{'idempotency-key':key})).status,409);
  assert.equal((await request(owner,root+'/stores','POST',input,{'idempotency-key':randomUUID()})).status,409);
  assert.equal((await request(stranger,path)).status,404);assert.equal((await request(staff,path)).status,404);
  assert.equal((await request(owner,path+'/publish','POST',{})).status,409);
  assert.equal((await request(owner,path+'/onboarding/complete','POST',{expectedVersion:0})).status,409);
  const settings={expectedVersion:0,contactEmail:owner.email,brandingName:'Journey brand',timezone:'Asia/Kolkata'};
  assert.equal((await request(owner,path+'/settings','PATCH',settings)).status,200);
  assert.equal((await request(owner,path+'/settings','PATCH',settings)).status,409);
  assert.equal((await request(owner,path+'/settings','PATCH',{expectedVersion:1,countryCode:'XX',currencyCode:'XXX'})).status,400);
  assert.equal((await request(owner,path+'/onboarding/complete','POST',{expectedVersion:1})).status,409,'Shipping and payment configuration is required.');
  const pricing={version:0,shipping:[{id:'standard',name:'Standard shipping',countries:['IN'],rateMinor:'5000',freeAboveMinor:'200000',active:true}],tax:{mode:'NONE',shippingTaxable:false,rates:[]},payments:{cod:true,simulator:false}};
  const configuredPricing=await request(owner,path+'/pricing','PUT',pricing);assert.equal(configuredPricing.status,200,JSON.stringify(configuredPricing.body));assert.equal(configuredPricing.body.version,1);
  assert.equal((await request(owner,path+'/pricing','PUT',pricing)).status,409);
  assert.equal((await request(stranger,path+'/pricing')).status,404);
  const pricingRace=await Promise.all([request(owner,path+'/pricing','PUT',{...pricing,version:1}),request(owner,path+'/pricing','PUT',{...pricing,version:1})]);assert.deepEqual(pricingRace.map(r=>r.status).sort(),[200,409]);
  const complete=await request(owner,path+'/onboarding/complete','POST',{expectedVersion:1});assert.equal(complete.status,201);assert.equal(complete.body.status,'DRAFT');assert.equal(complete.body.onboardingState,'COMPLETED');
  const product=await request(owner,path+'/products','POST',{name:'Journey bag',handle:'bag',priceMinor:'199900',variants:[{name:'Black',sku:'JOURNEY-1',stock:10}]});assert.equal(product.status,201,JSON.stringify(product.body));
  assert.equal((await request(owner,path+`/products/${product.body.id}/activate`,'POST',{})).status,201);
  assert.equal((await request(owner,path+'/publish','POST',{})).status,201);
  assert.equal((await request(owner,path+'/pricing','PUT',{...pricing,version:1,payments:{cod:false,simulator:false}})).status,409,'Unpublish before disabling all payment methods.');
  const publicCatalog=await request({},`/v1/storefront/${handle}/products`);assert.equal(publicCatalog.status,200);assert.equal(publicCatalog.body.products.length,1);assert.equal('ownerSubjectId'in publicCatalog.body.store,false);
  assert.equal((await request({},`/v1/admin/stores/${storeId}/products`,'GET',undefined,{'x-demo-subject-id':owner.id})).status,404,'Demo headers cannot access real merchant stores.');
  assert.deepEqual((await request({},'/v1/admin/stores','GET',undefined,{'x-demo-subject-id':owner.id})).body,[]);


  const productPath=path+`/products/${product.body.id}`;
  const secondVariant=await request(owner,productPath+'/variants','POST',{name:'White',sku:'JOURNEY-WHITE',priceMinor:'249900',options:{Color:'White'}});assert.equal(secondVariant.status,201);assert.equal(secondVariant.body.stock,0);
  assert.equal((await request(owner,productPath+`/variants/${secondVariant.body.id}`,'PATCH',{stock:100})).status,400);
  assert.equal((await request(owner,productPath+`/variants/${secondVariant.body.id}`,'PATCH',{name:'White edition'})).status,200);
  assert.equal((await request(owner,productPath+`/variants/${secondVariant.body.id}`,'PATCH',{options:{Color:123}})).status,400);
  assert.equal((await request(owner,productPath+'/variants','POST',{name:'White edition',sku:'OTHER-SKU'})).status,409);
  const deactivations=await Promise.all([request(owner,productPath+`/variants/${secondVariant.body.id}`,'PATCH',{active:false}),request(owner,productPath+`/variants/${product.body.variants[0].id}`,'PATCH',{active:false})]);
  assert.deepEqual(deactivations.map(r=>r.status).sort(),[200,409]);
  const remainingVariant=await db.productVariant.findFirstOrThrow({where:{productId:product.body.id,active:true}});
  assert.equal((await request(owner,productPath+`/variants/${remainingVariant.id}`,'PATCH',{active:false})).status,409);
  const filtered=await request(owner,path+'/products?query=journey&sort=price_desc&limit=1');assert.equal(filtered.status,200);assert.equal(filtered.body.items[0].id,product.body.id);
  assert.equal((await request(owner,path+'/products?limit=0')).status,400);
  assert.equal((await request(owner,path+`/products/${product.body.id}`)).status,200);
  assert.equal((await request(owner,path+`/products/${product.body.id}`,'PATCH',{seoTitle:'Journey SEO',seoDescription:'A safe public description'})).status,200);
  const detailed=await request({},`/v1/storefront/${handle}/products/bag`);assert.equal(detailed.status,200);assert.equal(detailed.body.seoTitle,'Journey SEO');assert.equal('storeId'in detailed.body,false);
  const archivedProduct=await request(owner,path+'/products','POST',{name:'Archived bag',handle:'archived-bag',priceMinor:'100',variants:[{name:'One',sku:'ARCHIVE-TEST',stock:0}]});
  assert.equal(archivedProduct.status,201);assert.equal((await request(owner,path+`/products/${archivedProduct.body.id}/archive`,'POST',{})).status,201);
  assert.equal((await request(owner,path+`/products/${archivedProduct.body.id}/activate`,'POST',{})).status,409);
  assert.equal((await request({},`/v1/storefront/${handle}/products/archived-bag`)).status,404);

  const collection=await request(owner,path+'/collections','POST',{name:'Featured bags',handle:'featured-bags',featured:true});assert.equal(collection.status,201);
  assert.equal((await request(owner,path+`/collections/${collection.body.id}/products/${product.body.id}`,'PUT',{expectedVersion:0,position:10})).status,200);
  assert.equal((await request(owner,path+`/collections/${collection.body.id}`,'PATCH',{expectedVersion:0,name:'Stale'})).status,409);
  assert.equal((await request(owner,path+`/collections/${collection.body.id}/products`)).body.items[0].id,product.body.id);
  const publicCollection=await request({},`/v1/storefront/${handle}/collections/featured-bags`);assert.equal(publicCollection.status,200);assert.equal(publicCollection.body.products[0].id,product.body.id);assert.equal('storeId'in publicCollection.body.collection,false);
  assert.equal((await request({},`/v1/storefront/${handle}/collections?featured=true`)).body.collections.length,1);
  const archivedCollection=await request(owner,path+`/collections/${collection.body.id}/archive`,'POST',{expectedVersion:1});assert.equal(archivedCollection.status,201);
  assert.equal((await request({},`/v1/storefront/${handle}/collections/featured-bags`)).status,404);

  const image=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer();
  const reservation=await request(owner,path+'/media/reservations','POST',{contentType:'image/png',size:image.length,checksum:createHash('sha256').update(image).digest('hex')});assert.equal(reservation.status,201);
  const assetId=reservation.body.assetId,plan=reservation.body.upload;
  assert.equal((await request({},`/v1/media/${assetId}`)).status,404);
  assert.equal((await fetch(base+plan.url,{method:'PUT',headers:{'content-type':'image/png','x-upload-token':'wrong'},body:image})).status,403);
  assert.equal((await fetch(base+plan.url,{method:'PUT',headers:plan.headers,body:image})).status,200);
  assert.equal((await request(owner,path+`/media/${assetId}/complete`,'POST',{})).status,201);
  assert.equal((await request(stranger,path+`/media/${assetId}/complete`,'POST',{})).status,404);
  const beforeImages=(await request(owner,productPath)).body;
  const attached=await request(owner,productPath+'/images','PUT',{expectedVersion:beforeImages.version,assetIds:[assetId],primaryAssetId:assetId,altTexts:{[assetId]:'Journey bag'}});assert.equal(attached.status,200);assert.equal(attached.body.images[0].assetId,assetId);
  const rendered=await fetch(base+`/v1/media/${assetId}`);assert.equal(rendered.status,200);assert.equal(rendered.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await rendered.arrayBuffer()),image);
  assert.equal((await request(owner,path+`/media/${assetId}`,'DELETE')).status,409);
  assert.equal((await request(owner,productPath+'/images','PUT',{expectedVersion:attached.body.version,assetIds:[]})).status,200);
  assert.equal((await request(owner,path+`/media/${assetId}`,'DELETE')).status,200);
  assert.equal((await fetch(base+`/v1/media/${assetId}`)).status,404);
  const allocationProduct=await request(owner,path+'/products','POST',{name:'Allocation fixture',handle:'allocation-fixture',priceMinor:'100',variants:[{name:'One',sku:'ALLOCATE-ONE',stock:1}]});assert.equal(allocationProduct.status,201);
  assert.equal((await request(owner,path+`/products/${allocationProduct.body.id}/activate`,'POST',{})).status,201);
  const allocationInput={key:randomUUID(),lines:[{variantId:allocationProduct.body.variants[0].id,quantity:1}]};
  const allocation=await request(owner,path+'/inventory/reservations','POST',allocationInput);assert.equal(allocation.status,201,JSON.stringify(allocation.body));
  assert.equal((await request(owner,path+'/inventory/reservations','POST',allocationInput)).body.id,allocation.body.id);
  assert.equal((await request(owner,path+'/inventory/reservations','POST',{...allocationInput,key:randomUUID()})).status,409);
  assert.equal((await request(stranger,path+`/inventory/reservations/${allocation.body.id}`)).status,404);
  const heldPublic=await request({},`/v1/storefront/${handle}/products/allocation-fixture`);assert.equal(heldPublic.body.variants[0].stock,0);assert.equal('reserved'in heldPublic.body.variants[0],false);
  assert.equal((await request(owner,path+`/inventory/reservations/${allocation.body.id}/release`,'POST',{})).body.status,'RELEASED');
  assert.equal((await request(owner,path+`/inventory/reservations/${allocation.body.id}/release`,'POST',{})).body.status,'RELEASED');
  const invite=await request(owner,`${root}/accounts/${merchantId}/invitations`,'POST',{storeId,email:staff.email,role:'STORE_VIEWER'});assert.equal(invite.status,201);
  const invitationMail=await db.identityMail.findFirstOrThrow({where:{recipient:staff.email,purpose:'INVITE'},orderBy:{createdAt:'desc'}}),token=decryptMail(invitationMail.encryptedPayload).token;
  assert.equal((await request(stranger,root+'/invitations/accept','POST',{token})).status,400);
  assert.equal((await request(staff,root+'/invitations/accept','POST',{token})).status,201);
  assert.equal((await request(staff,root+'/invitations/accept','POST',{token})).status,400);
  assert.equal((await request(staff,path+'/products')).status,200);
  assert.equal((await request(staff,path+'/products','POST',{})).status,400,'DTO validation happens before the use case.');
  assert.equal((await request(staff,path+'/products','POST',{name:'Denied',handle:'denied',priceMinor:'100',variants:[{name:'One',sku:'DENIED',stock:1}]})).status,403);
  assert.equal((await request(staff,path+'/publish','POST',{})).status,403);
  assert.equal((await request(owner,path+`/members/${staff.id}`,'PATCH',{role:'STORE_EDITOR'})).status,200);
  assert.equal((await request(staff,path+`/variants/${product.body.variants[0].id}/stock-adjustments`,'POST',{quantity:12,reason:'RECEIVED'})).status,201);
  assert.equal((await request(staff,`${root}/accounts/${merchantId}/members/${staff.id}`,'PATCH',{role:'ACCOUNT_OWNER'})).status,403);
  // A request starting before a revocation commits must recheck authority after
  // acquiring the same account lock used by membership mutations.
  const locker=new pg.Client({connectionString:process.env.DATABASE_URL});await locker.connect();
  let pending,blocked=0;
  try {
    await locker.query('BEGIN');
    await locker.query('SELECT id FROM "MerchantAccount" WHERE id=$1 FOR UPDATE',[merchantId]);
    await locker.query('DELETE FROM "StoreMembership" WHERE "storeId"=$1 AND "identityId"=$2',[storeId,staff.id]);
    pending=request(staff,path+'/products','POST',{name:'Stale authority',handle:'stale-authority',priceMinor:'100',variants:[{name:'One',sku:'STALE-AUTH',stock:1}]});
    for(let i=0;i<100;i++){
      await locker.query('SELECT pg_stat_clear_snapshot()');
      blocked=(await locker.query("SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%MerchantAccount%'")).rows[0].count;
      if(blocked)break;await delay(20);
    }
    await locker.query('COMMIT');
  } finally {await locker.query('ROLLBACK');await locker.end();}
  assert.ok(blocked,'Store mutation must wait on the account revocation lock.');
  assert.equal((await pending).status,404);
  assert.equal(await db.product.count({where:{storeId,handle:'stale-authority'}}),0);
  assert.equal((await request(owner,path+`/members/${staff.id}`,'DELETE')).status,200);
  assert.equal((await request(staff,path+'/products')).status,404,'Removed store membership loses authority immediately.');
  assert.equal((await request(owner,`${root}/accounts/${merchantId}/members/${owner.id}`,'DELETE')).status,409);
  assert.equal((await request(owner,path+'/suspend','POST',{})).status,201);
  assert.equal((await request({},`/v1/storefront/${handle}/products`)).status,404);
  assert.equal((await request(owner,path+'/resume','POST',{})).status,201);
  assert.equal((await request({},`/v1/storefront/${handle}/products`)).status,200);
  assert.equal((await request(owner,`${root}/accounts/${merchantId}/suspend`,'POST',{})).status,201);
  assert.equal((await request({},`/v1/storefront/${handle}/products`)).status,404);
  assert.equal((await request(owner,`${root}/accounts/${merchantId}/resume`,'POST',{})).status,201);
  assert.equal((await request(owner,'/v1/auth/deactivate','POST',{})).status,409,'Last owner cannot deactivate.');
  const archived=await request(owner,root+'/stores','POST',{...input,handle:handle+'-archive'},{'idempotency-key':randomUUID()});
  assert.equal(archived.status,201);assert.equal((await request(owner,`${root}/stores/${archived.body.id}/archive`,'POST',{})).status,201);
  assert.ok(!(await request(owner,root+'/stores')).body.some(s=>s.id===archived.body.id));
  // Promote the verified invited account member; account-owner permission is inherited.
  assert.equal((await request(owner,`${root}/accounts/${merchantId}/members/${staff.id}`,'PATCH',{role:'ACCOUNT_OWNER'})).status,200);
  const removals=await Promise.all([request(owner,`${root}/accounts/${merchantId}/members/${owner.id}`,'DELETE'),request(staff,`${root}/accounts/${merchantId}/members/${staff.id}`,'DELETE')]);
  assert.deepEqual(removals.map(r=>r.status).sort(),[200,409]);
  assert.equal(await db.merchantMembership.count({where:{merchantId,role:'ACCOUNT_OWNER'}}),1);
  assert.equal((await request(stranger,'/v1/auth/deactivate','POST',{})).status,201);
  assert.equal((await request(stranger,'/v1/auth/me')).status,401);
  const remaining=await db.merchantMembership.findFirstOrThrow({where:{merchantId,role:'ACCOUNT_OWNER'}});
  await db.identity.update({where:{id:remaining.identityId},data:{status:'SUSPENDED'}});
  assert.equal((await db.merchantAccount.findUniqueOrThrow({where:{id:merchantId}})).status,'RECOVERY_REQUIRED');
  assert.equal((await request({},`/v1/storefront/${handle}/products`)).status,404);
  assert.ok(!logs.includes(password));assert.ok(!logs.includes(token));
});
