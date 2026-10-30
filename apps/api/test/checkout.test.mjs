import assert from 'node:assert/strict';
import test from 'node:test';
import {checkoutContact,checkoutVersion,checkoutProjection} from '../src/checkout/domain/checkout.ts';
test('checkout lifecycle rejects stale/closed work and projections omit internal item SKU',()=>{
  const row={id:'fixture',cartId:'cart',version:2,status:'READY',expiresAt:new Date(Date.now()+60000),contactEmail:'shopper@example.test',contactName:'Shopper',shippingAddress:null,shippingMethodId:'standard',snapshot:{baseVersion:1,cartVersion:1,currencyCode:'INR',totals:{totalMinor:'100'},shippingMethodName:'Standard',items:[{productId:'p',variantId:'v',productName:'Product',variantName:'One',sku:'INTERNAL-SKU',quantity:1,unitPriceMinor:'100',subtotalMinor:'100'}]}};
  row.snapshot.privateProviderField='hidden';row.snapshot.items[0].privateMerchantField='hidden-too';
  const projection=checkoutProjection(row);assert.equal(JSON.stringify(projection).includes('INTERNAL-SKU'),false);assert.equal('privateProviderField'in projection.snapshot,false);assert.equal('privateMerchantField'in projection.snapshot.items[0],false);
  assert.deepEqual(checkoutContact(' SHOPPER@example.test ',' Shopper '),{contactEmail:'shopper@example.test',contactName:'Shopper'});
  assert.throws(()=>checkoutContact('bad','name'),{code:'INVALID'});assert.throws(()=>checkoutContact('good@example.test',' '),{code:'INVALID'});
  assert.throws(()=>checkoutVersion(row,1),{code:'CONFLICT'});assert.throws(()=>checkoutVersion({...row,status:'CANCELLED'},2),{code:'CONFLICT'});assert.throws(()=>checkoutVersion({...row,expiresAt:new Date(0)},2),{code:'CONFLICT'});
});
