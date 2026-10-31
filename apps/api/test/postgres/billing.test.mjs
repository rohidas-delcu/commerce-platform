import assert from 'node:assert/strict';
import test from 'node:test';
import {customerAddress} from '../../dist/customer/domain/customer.js';
import {randomUUID} from 'node:crypto';
import {storefrontFixture,fixtureAddress} from '../support/storefront.mjs';

test('checkout billing resumes independently and snapshots exact COD and simulated receipts without leaking across customers',{timeout:60000},async t=>{
  const f=await storefrontFixture(t),owner=await f.register(),store=await f.store(owner,3),buyer=await f.register(store.handle),stranger=await f.register(store.handle);
  const policy=(await f.request(owner,store.path+'/pricing')).body;
  assert.equal((await f.request(owner,store.path+'/pricing','PUT',{...policy,payments:{cod:true,simulator:true}})).status,200);
  await f.cart(buyer,store);let checkout=await f.checkout(buyer,store);
  let current=(await f.request(buyer,checkout.path)).body;
  assert.equal(current.billingSameAsShipping,true);assert.deepEqual(current.billingAddress,customerAddress(fixtureAddress));
  const billing={...fixtureAddress,name:'Billing recipient',line1:'50 Billing Lane',city:'Boston',region:'MA',postalCode:'02108',countryCode:'US'};
  for(const input of [{billingSameAsShipping:true,billingAddress:billing},{billingSameAsShipping:false},{billingSameAsShipping:'true'},{billingAddress:{...billing,countryCode:'ZZ'}},{billingAddressSource:'LEGACY_NOT_COLLECTED'}]){
    assert.equal((await f.request(buyer,checkout.path,'PATCH',{expectedVersion:current.version,...input})).status,400);
  }
  current=(await f.request(buyer,checkout.path,'PATCH',{expectedVersion:current.version,billingAddress:billing})).body;
  assert.deepEqual(current.billingAddress,customerAddress(billing));assert.equal(current.billingSameAsShipping,false);
  assert.deepEqual((await f.request(buyer,checkout.path)).body.billingAddress,customerAddress(billing));
  const held=await f.request(buyer,checkout.path+'/reserve','POST',{expectedVersion:current.version});assert.equal(held.status,201);
  const changed=await f.request(buyer,checkout.path,'PATCH',{expectedVersion:held.body.version,shippingAddress:{...fixtureAddress,line1:'14 Shipping Road'}});assert.equal(changed.status,200);
  assert.equal(changed.body.status,'DRAFT');assert.deepEqual(changed.body.billingAddress,customerAddress(billing));assert.equal((await f.db.productVariant.findUniqueOrThrow({where:{id:store.variantId}})).reserved,0);
  const ready=await f.request(buyer,checkout.path+'/reserve','POST',{expectedVersion:changed.body.version});assert.equal(ready.status,201);
  const placed=await f.request(buyer,checkout.path+'/place','POST',{expectedVersion:ready.body.version,paymentMethod:'COD'},{'idempotency-key':randomUUID()});assert.equal(placed.status,201,JSON.stringify(placed.body));
  const receipt=placed.body;assert.deepEqual(receipt.billingAddress,customerAddress(billing));assert.equal(receipt.billingAddressSource,'CUSTOMER_PROVIDED');assert.equal(receipt.shippingAddress.countryCode,'IN');assert.equal(receipt.totalMinor,'1000');
  assert.deepEqual((await f.request(owner,store.path+'/orders/'+receipt.id)).body.billingAddress,customerAddress(billing));
  assert.equal((await f.request(stranger,store.root+'/customer/orders/'+receipt.id)).status,404);
  await assert.rejects(f.db.order.update({where:{id:receipt.id},data:{billingAddress:fixtureAddress}}));
  await assert.rejects(f.db.order.update({where:{id:receipt.id},data:{billingAddressSource:'SHIPPING_DEFAULT'}}));
  assert.equal(JSON.stringify((await f.request({},store.root+'/products')).body).includes('50 Billing Lane'),false);

  await f.cart(buyer,store);checkout=await f.checkout(buyer,store);
  current=(await f.request(buyer,checkout.path,'PATCH',{expectedVersion:checkout.version,billingAddress:billing})).body;
  current=(await f.request(buyer,checkout.path,'PATCH',{expectedVersion:current.version,billingSameAsShipping:true})).body;
  assert.equal(current.billingSameAsShipping,true);assert.deepEqual(current.billingAddress,customerAddress(fixtureAddress));
  const reserved=await f.request(buyer,checkout.path+'/reserve','POST',{expectedVersion:current.version});assert.equal(reserved.status,201);
  const payment=await f.request(buyer,checkout.path+'/payments','POST',{expectedVersion:reserved.body.version,method:'SIMULATOR',scenario:'MANUAL'},{'idempotency-key':randomUUID()});assert.equal(payment.status,201);
  assert.equal((await f.request(buyer,checkout.path,'PATCH',{expectedVersion:reserved.body.version,billingAddress:billing})).status,409);
  const paid=await f.request(buyer,store.root+'/customer/payments/'+payment.body.id+'/simulate','POST',{key:randomUUID(),event:'CAPTURED'});assert.equal(paid.status,201);assert.equal(paid.body.status,'SUCCEEDED');
  const saved=(await f.request(buyer,store.root+'/customer/orders/'+paid.body.orderId)).body;
  assert.equal(saved.billingAddressSource,'SHIPPING_DEFAULT');assert.deepEqual(saved.billingAddress,saved.shippingAddress);assert.equal(saved.paymentStatus,'PAID');
  assert.deepEqual((await f.request(buyer,store.root+'/customer/orders/'+receipt.id)).body.billingAddress,customerAddress(billing));
});
