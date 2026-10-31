import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {MemoryCommerceRepository} from '../src/infrastructure/memory-commerce.repository.ts';
import {CommerceService} from '../src/application/commerce.service.ts';
test('memory public branding selects safe metadata and protects its logo reference',async()=>{
  const repo=new MemoryCommerceRepository(false),store={id:randomUUID(),ownerSubjectId:'private-owner',name:'Store',brandingName:'Brand',handle:'branding-fixture',countryCode:'IN',currencyCode:'INR',status:'PUBLISHED',createdAt:new Date().toISOString()},assetId=randomUUID();
  await repo.createStore(store);await repo.media.reserve({id:assetId,storeId:store.id,key:store.id+'/'+assetId,provider:'local',contentType:'image/png',size:8,checksum:'a'.repeat(64),tokenDigest:'b'.repeat(64),status:'PENDING',expiresAt:new Date(Date.now()+60000)});await repo.saveStore({...store,logoAssetId:assetId});const service=new CommerceService(repo);
  assert.equal((await service.publicStore(store.handle)).branding.logo,null);await repo.media.complete(store.id,assetId);const publicStore=await service.publicStore(store.handle);assert.equal(publicStore.branding.logo.id,assetId);assert.equal('ownerSubjectId'in publicStore,false);assert.equal('id'in publicStore,false);await assert.rejects(repo.media.remove(store.id,assetId),{code:'CONFLICT'});await repo.saveStore({...store,logoAssetId:assetId,status:'DRAFT'});await assert.rejects(service.publicStore(store.handle),{code:'NOT_FOUND'});
});
