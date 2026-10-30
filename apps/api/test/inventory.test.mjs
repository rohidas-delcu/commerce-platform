import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {MemoryCommerceRepository} from '../src/infrastructure/memory-commerce.repository.ts';
import {InventoryService} from '../src/inventory/application/inventory.service.ts';
import {reservationRequest,reservationTransition,availableStock} from '../src/inventory/domain/inventory.ts';
import {publicProduct} from '../src/domain/commerce.ts';
async function fixture(){
  const repo=new MemoryCommerceRepository(false),storeId=randomUUID(),variantId=randomUUID();
  await repo.createStore({id:storeId,ownerSubjectId:'fixture',name:'Store',handle:storeId,countryCode:'IN',currencyCode:'INR',status:'PUBLISHED',createdAt:new Date().toISOString()});
  const product=await repo.createProduct({id:randomUUID(),storeId,version:0,name:'Product',handle:'one',description:'',collection:'',priceMinor:'100',compareMinor:null,status:'ACTIVE',createdAt:new Date().toISOString(),variants:[{id:variantId,name:'One',sku:'INV-1',stock:1}]});
  let now=new Date();return{repo,storeId,variantId,product,service:new InventoryService(repo.inventory,()=>now),advance:()=>{now=new Date(now.getTime()+120000);}};
}
test('reservations validate bounded quantities, keys, TTL and terminal transitions',()=>{
  const id=randomUUID(),now=new Date(),request={key:'stable_key',lines:[{variantId:id,quantity:1}]};
  assert.equal(reservationRequest(id,request,now).expiresAt.getTime()-now.getTime(),900000);
  for(const input of [{...request,key:'x'},{...request,lines:[]},{...request,ttlSeconds:59},{...request,lines:[...request.lines,...request.lines]},{...request,lines:[{variantId:id,quantity:0}]}])assert.throws(()=>reservationRequest(id,input,now),{code:'INVALID'});
  assert.throws(()=>availableStock(1,2),{code:'CONFLICT'});assert.equal(availableStock(5,3),2);
  assert.throws(()=>reservationTransition('ACTIVE','commit',now,now),{code:'CONFLICT'});
  assert.equal(reservationTransition('COMMITTED','expire',now,now),'COMMITTED');
});
test('memory reservations prevent overselling, preserve holds on metadata changes and commit exactly once',async()=>{
  const{repo,storeId,variantId,product,service}=await fixture();
  const input={key:'reserve_one',lines:[{variantId,quantity:1}]};
  const attempts=await Promise.allSettled([service.reserve(storeId,input,'fixture'),service.reserve(storeId,{...input,key:'reserve_two'},'fixture')]);
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);const held=attempts.find(r=>r.status==='fulfilled').value;
  assert.equal((await service.reserve(storeId,input,'fixture')).id,held.id);
  await assert.rejects(service.reserve(storeId,{...input,lines:[{variantId,quantity:2}]},'fixture'),{code:'CONFLICT'});
  let current=await repo.findProduct(storeId,product.id);assert.equal(current.variants[0].reserved,1);assert.equal(publicProduct(current).variants[0].stock,0);
  await repo.saveVariant(storeId,product.id,{...current.variants[0],reserved:0,name:'Edited'});
  assert.equal((await repo.findProduct(storeId,product.id)).variants[0].reserved,1);
  await assert.rejects(repo.adjustStock({storeId,variantId,after:0,reason:'DAMAGED',note:'',actorSubjectId:'fixture'}),{code:'CONFLICT'});
  assert.equal((await service.transition(storeId,held.id,'commit','checkout')).status,'COMMITTED');
  await service.transition(storeId,held.id,'commit','checkout');
  assert.equal((await repo.listMovements(storeId)).length,1);current=await repo.findProduct(storeId,product.id);assert.equal(current.variants[0].stock,0);assert.equal(current.variants[0].reserved,0);
  await assert.rejects(service.transition(storeId,held.id,'release','fixture'),{code:'CONFLICT'});
});
test('memory expiry/release and rejected multi-line requests leave exact stock and tenant state',async()=>{
  const{repo,storeId,variantId,product,service,advance}=await fixture();
  await assert.rejects(service.reserve(storeId,{key:'atomic_invalid',lines:[{variantId,quantity:1},{variantId:randomUUID(),quantity:1}]},'fixture'),{code:'NOT_FOUND'});
  assert.equal((await repo.findProduct(storeId,product.id)).variants[0].reserved??0,0);
  const held=await service.reserve(storeId,{key:'expire_fixture',ttlSeconds:60,lines:[{variantId,quantity:1}]},'fixture');
  await assert.rejects(service.find(randomUUID(),held.id),{code:'NOT_FOUND'});advance();
  await assert.rejects(service.transition(storeId,held.id,'commit','checkout'),{code:'CONFLICT'});
  assert.equal((await service.expire(storeId,'worker')).expired,1);assert.equal((await service.expire(storeId,'worker')).expired,0);
  assert.equal((await service.transition(storeId,held.id,'release','fixture')).status,'EXPIRED');
  const second=await service.reserve(storeId,{key:'release_fixture',lines:[{variantId,quantity:1}]},'fixture');
  await service.transition(storeId,second.id,'release','fixture');await service.transition(storeId,second.id,'release','fixture');
  const current=await repo.findProduct(storeId,product.id);assert.equal(current.variants[0].stock,1);assert.equal(current.variants[0].reserved,0);assert.equal((await repo.listMovements(storeId)).length,0);
});
