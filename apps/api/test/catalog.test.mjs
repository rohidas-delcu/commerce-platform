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

test('variant metadata keeps stock separate and protects activation and SKU invariants',async()=>{
  const repository=new MemoryCommerceRepository(false),service=new CommerceService(repository),store=await service.createStore('owner',{name:'Variants',handle:'variants'});
  const product=await service.createProduct('owner',store.id,{name:'Bag',handle:'bag',priceMinor:'100',variants:[{name:'Black',sku:'BAG-BLACK',stock:10}]});
  const first=product.variants[0];await service.activateProduct('owner',store.id,product.id);
  await assert.rejects(service.updateVariant('owner',store.id,product.id,first.id,{active:false}),{code:'CONFLICT'});
  const second=await service.createVariant('owner',store.id,product.id,{name:'White',sku:'bag-white',priceMinor:'200',compareMinor:'300',options:{Color:'White'}});
  assert.equal(second.stock,0);assert.equal(second.sku,'BAG-WHITE');
  await service.adjustStock('owner',store.id,second.id,{quantity:5,reason:'RECEIVED'});
  await service.updateVariant('owner',store.id,product.id,first.id,{active:false});
  await service.updateVariant('owner',store.id,product.id,second.id,{name:'White edition'});
  assert.equal((await service.productDetail('owner',store.id,product.id)).variants.find(v=>v.id===second.id).stock,5);
  await service.publishStore('owner',store.id);
  const catalog=await service.publicCatalog('variants');assert.equal(catalog.products[0].variants.length,1);assert.equal(catalog.products[0].variants[0].priceMinor,'200');assert.equal('sku'in catalog.products[0].variants[0],false);
  await assert.rejects(service.createVariant('owner',store.id,product.id,{name:'WHITE EDITION',sku:'ANOTHER'}),{code:'CONFLICT'});
  await assert.rejects(service.updateVariant('owner',store.id,product.id,second.id,{priceMinor:'500',compareMinor:'400'}),{code:'INVALID'});
  await assert.rejects(service.updateVariant('owner',store.id,product.id,second.id,{options:{Size:3}}),{code:'INVALID'});
  const cleared=await service.updateVariant('owner',store.id,product.id,second.id,{priceMinor:null});assert.equal(cleared.compareMinor,null);
});
