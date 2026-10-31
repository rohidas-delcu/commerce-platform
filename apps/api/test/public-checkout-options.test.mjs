import assert from 'node:assert/strict';
import test from 'node:test';
import {CommerceService} from '../src/application/commerce.service.ts';
import {MemoryCommerceRepository} from '../src/infrastructure/memory-commerce.repository.ts';

test('public checkout options expose only active delivery methods, not merchant tax or pricing internals',async()=>{
  const repository=new MemoryCommerceRepository(false);
  const service=new CommerceService(repository);
  const store=await service.createStore('owner',{name:'Checkout',handle:'checkout-options'});
  const policy={version:0,shipping:[
    {id:'standard',name:'Standard delivery',countries:['IN'],rateMinor:'7900',freeAboveMinor:'250000',active:true},
    {id:'retired',name:'Retired',countries:['IN'],rateMinor:'0',freeAboveMinor:null,active:false}
  ],tax:{mode:'EXCLUSIVE',shippingTaxable:true,rates:[{countryCode:'IN',basisPoints:1800}]},payments:{cod:true,simulator:false}};
  await repository.pricing.savePolicy(store.id,policy,'owner');
  await assert.rejects(service.publicCheckoutOptions(store.handle),{code:'NOT_FOUND'});
  await service.publishStore('owner',store.id);
  const options=await service.publicCheckoutOptions(store.handle);
  assert.deepEqual(options.shipping,[{id:'standard',name:'Standard delivery',countries:['IN'],rateMinor:'7900',freeAboveMinor:'250000'}]);
  assert.equal(options.payments.cod,true);
  assert.equal(options.payments.simulator,false);
  assert.equal('tax'in options,false);
  assert.equal('merchantId'in options,false);
  assert.equal('version'in options,false);
});
