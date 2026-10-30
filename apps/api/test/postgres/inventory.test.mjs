import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';
import {PrismaCommerceRepository} from '../../dist/infrastructure/prisma-commerce.repository.js';
import {InventoryService} from '../../dist/inventory/application/inventory.service.js';
async function fixture(t){
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL required.');
  const repo=new PrismaCommerceRepository();await repo.onModuleInit();const sql=new pg.Client({connectionString:process.env.DATABASE_URL});await sql.connect();
  const store=await repo.createStore({id:randomUUID(),ownerSubjectId:randomUUID(),name:'Reservation fixture',handle:randomUUID(),countryCode:'IN',currencyCode:'INR',status:'PUBLISHED',createdAt:new Date().toISOString()});
  // Fixture-only ownership mapping; no application endpoint can claim quarantined data.
  await sql.query('UPDATE "MerchantAccount" SET status=\'ACTIVE\' WHERE id=(SELECT "merchantId" FROM "Store" WHERE id=$1)',[store.id]);
  const product=await repo.createProduct({id:randomUUID(),storeId:store.id,version:0,name:'Last unit',handle:'last-unit',description:'',collection:'',priceMinor:'100',compareMinor:null,status:'ACTIVE',createdAt:new Date().toISOString(),variants:[{id:randomUUID(),name:'One',sku:'HOLD-ONE',stock:1}]});
  const service=new InventoryService(repo.inventory),variantId=product.variants[0].id,storeId=store.id,input={key:randomUUID(),lines:[{variantId,quantity:1}]};
  t.after(async()=>{await sql.query('ROLLBACK');for(const table of ['InventoryReservationEvent','InventoryReservationLine','InventoryReservation','InventoryMovement','ProductVariant','Product','Store'])await sql.query(`DELETE FROM "${table}" WHERE ${table==='Store'?'id':'"storeId"'}=$1`,[storeId]);await repo.onModuleDestroy();await sql.end();});
  return{repo,sql,service,storeId,variantId,product,input};
}
test('PostgreSQL competing reservations enforce last-unit availability, retry identity and SQL tenant constraints',{timeout:15000},async t=>{
  const{repo,sql,service,storeId,variantId,product,input}=await fixture(t);
  const results=await Promise.allSettled([service.reserve(storeId,input,'checkout-A'),service.reserve(storeId,{...input,key:randomUUID()},'checkout-B')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'CONFLICT');
  const held=results.find(r=>r.status==='fulfilled').value;
  const retry=await service.reserve(storeId,{...input,key:held.key},'checkout');assert.equal(retry.id,held.id);
  await assert.rejects(service.reserve(storeId,{...input,key:held.key,lines:[{variantId,quantity:2}]},'checkout'),{code:'CONFLICT'});
  await assert.rejects(repo.adjustStock({storeId,variantId,after:0,reason:'DAMAGED',note:'',actorSubjectId:'fixture'}),{code:'CONFLICT'});
  await assert.rejects(sql.query('UPDATE "ProductVariant" SET reserved=2 WHERE id=$1',[variantId]),{code:'23514'});
  await assert.rejects(sql.query('UPDATE "InventoryReservationLine" SET "storeId"=$2 WHERE "reservationId"=$1',[held.id,randomUUID()]),{code:'23503'});
  await assert.rejects(service.find(randomUUID(),held.id),{code:'NOT_FOUND'});
  const race=await Promise.allSettled([service.transition(storeId,held.id,'commit','checkout'),service.transition(storeId,held.id,'release','timeout')]);
  const final=await service.find(storeId,held.id),current=(await repo.findProduct(storeId,product.id)).variants[0];
  assert.equal(current.reserved,0);
  if(final.status==='COMMITTED'){assert.equal(current.stock,0);await service.transition(storeId,held.id,'commit','checkout');assert.equal((await repo.listMovements(storeId)).length,1);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);}else{assert.equal(final.status,'RELEASED');assert.equal(current.stock,1);assert.equal((await repo.listMovements(storeId)).length,0);}
});
test('PostgreSQL partial reservation failure rolls back and commit movement failure rolls back both counters and lifecycle',{timeout:15000},async t=>{
  const{repo,sql,service,storeId,variantId,product,input}=await fixture(t);
  await assert.rejects(service.reserve(storeId,{key:randomUUID(),lines:[{variantId,quantity:1},{variantId:randomUUID(),quantity:1}]},'checkout'),{code:'NOT_FOUND'});
  assert.equal((await repo.findProduct(storeId,product.id)).variants[0].reserved,0);
  const held=await service.reserve(storeId,input,'checkout'),name=`inv_reject_${randomUUID().replaceAll('-','')}`;
  await sql.query(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled movement failure'; END; $$`);
  await sql.query(`CREATE TRIGGER "${name}" BEFORE INSERT ON "InventoryMovement" FOR EACH ROW WHEN (NEW."variantId"='${variantId}'::uuid) EXECUTE FUNCTION "${name}"()`);
  try{await assert.rejects(service.transition(storeId,held.id,'commit','checkout'));const current=(await repo.findProduct(storeId,product.id)).variants[0];assert.equal(current.stock,1);assert.equal(current.reserved,1);assert.equal((await service.find(storeId,held.id)).status,'ACTIVE');assert.equal((await repo.listMovements(storeId)).length,0);assert.equal((await sql.query('SELECT COUNT(*)::int AS count FROM "InventoryReservationEvent" WHERE "reservationId"=$1',[held.id])).rows[0].count,1);}finally{await sql.query(`DROP TRIGGER "${name}" ON "InventoryMovement"`);await sql.query(`DROP FUNCTION "${name}"()`);}
  await service.transition(storeId,held.id,'commit','checkout');await service.transition(storeId,held.id,'commit','checkout');assert.equal((await repo.listMovements(storeId)).length,1);
});
test('PostgreSQL commitment rechecks real expiry after waiting for locks; expiry releases exactly once',{timeout:15000},async t=>{
  const{repo,sql,service,storeId,variantId,product,input}=await fixture(t);const held=await service.reserve(storeId,input,'checkout');
  await sql.query('UPDATE "InventoryReservation" SET "expiresAt"=clock_timestamp()+interval \'300 milliseconds\' WHERE id=$1',[held.id]);
  await sql.query('BEGIN');await sql.query('SELECT id FROM "Store" WHERE id=$1 FOR UPDATE',[storeId]);
  const pending=service.transition(storeId,held.id,'commit','callback').then(value=>({value}),error=>({error}));await delay(600);await sql.query('COMMIT');
  const result=await pending;assert.equal(result.error?.code,'CONFLICT');
  assert.equal((await service.expire(storeId,'worker')).expired,1);assert.equal((await service.expire(storeId,'worker')).expired,0);
  const current=(await repo.findProduct(storeId,product.id)).variants[0];assert.equal(current.stock,1);assert.equal(current.reserved,0);assert.equal((await repo.listMovements(storeId)).length,0);
});
