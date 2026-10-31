import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {cartProjection,cartQuantity,cartVersion} from '../src/cart/domain/cart.ts';
test('cart projections use exact server prices and omit private catalog/ownership fields',()=>{
  const id=randomUUID(),cart={id,storeId:randomUUID(),customerId:randomUUID(),secretDigest:'secret-never-public',status:'ACTIVE',version:0,expiresAt:new Date(Date.now()+60000),mergedIntoId:null,lines:[{variantId:id,quantity:999,priceSeenMinor:'1'}]};
  const product={id:randomUUID(),storeId:cart.storeId,name:'Product',handle:'product',status:'ACTIVE',version:0,createdAt:new Date().toISOString(),description:'',collection:'',priceMinor:'999999999999999999',compareMinor:null,variants:[{id,name:'One',sku:'PRIVATE-SKU',stock:1000,reserved:2}]};
  let view=cartProjection(cart,new Map([[id,product]]),'INR');assert.equal(view.subtotalMinor,(999n*999999999999999999n).toString());assert.equal(view.valid,false);assert.deepEqual(view.validation.map(v=>v.code),['STOCK_SHORTAGE','PRICE_CHANGED']);assert.equal(JSON.stringify(view).includes('PRIVATE-SKU'),false);assert.equal('secretDigest'in view,false);assert.equal('customerId'in view,false);
  view=cartProjection(cart,new Map([[id,{...product,status:'ARCHIVED'}]]),'INR');assert.deepEqual(view.validation,[{variantId:id,code:'UNAVAILABLE'}]);assert.equal('name'in view.items[0],false);assert.equal(view.subtotalMinor,'0');
  for(const value of [0,1000,1.2,-1])assert.throws(()=>cartQuantity(value),{code:'INVALID'});
  assert.throws(()=>cartVersion(cart,1),{code:'CONFLICT'});assert.throws(()=>cartVersion({...cart,expiresAt:new Date(0)},0),{code:'CONFLICT'});
});
