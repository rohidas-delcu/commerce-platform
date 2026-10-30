import assert from 'node:assert/strict';
import test from 'node:test';
import {CommerceService} from '../src/application/commerce.service.ts';
import {MemoryCommerceRepository} from '../src/infrastructure/memory-commerce.repository.ts';
import {productQuery} from '../src/domain/commerce.ts';

test('catalog detail, exact-money sorting, bounded pages and publication/archive rules share domain use cases',async()=>{
  const service=new CommerceService(new MemoryCommerceRepository(false));
  const store=await service.createStore('owner',{name:'Catalog',handle:'catalog'});
  const input=(name,price)=>({name,handle:name.toLowerCase(),priceMinor:price,seoTitle:'Exact money',variants:[{name:'One',sku:name.toUpperCase(),stock:1}]});
  await assert.rejects(service.createProduct('owner',store.id,{...input('Invalid','100'),seoTitle:'x'.repeat(71)}),{code:'INVALID'});
  const high=await service.createProduct('owner',store.id,input('High','999999999999999999'));
  const low=await service.createProduct('owner',store.id,input('Low','999999999999999998'));
  assert.equal((await service.queryProducts('owner',store.id,{sort:'price_asc',limit:1})).items[0].id,low.id);
  const page=await service.queryProducts('owner',store.id,{sort:'price_asc',limit:1});assert.equal(page.nextOffset,1);
  assert.equal((await service.queryProducts('owner',store.id,{sort:'price_asc',limit:1,offset:page.nextOffset})).items[0].id,high.id);
  await service.activateProduct('owner',store.id,high.id);await service.publishStore('owner',store.id);
  const detail=await service.publicProductDetail('catalog','high');assert.equal(detail.seoTitle,'Exact money');assert.equal('sku'in detail.variants[0],false);
  assert.equal((await service.publicCatalog('catalog',{query:'HIGH'})).products.length,1);
  await assert.rejects(service.publicProductDetail('catalog','low'),{code:'NOT_FOUND'});
  await service.productState('owner',store.id,high.id,'DRAFT');await assert.rejects(service.publicProductDetail('catalog','high'),{code:'NOT_FOUND'});
  await service.productState('owner',store.id,low.id,'ARCHIVED');await assert.rejects(service.activateProduct('owner',store.id,low.id),{code:'CONFLICT'});
  await assert.rejects(service.productDetail('other',store.id,high.id),{code:'NOT_FOUND'});
  assert.equal((await service.queryProducts('owner',store.id,{status:'ARCHIVED'})).items[0].id,low.id);
  for(const query of [{limit:0},{limit:101},{offset:-1},{sort:'unsafe'},{status:'UNKNOWN'}])assert.throws(()=>productQuery(query));
});
