import assert from 'node:assert/strict';
import test from 'node:test';
import {allocateMinor,orderProjection,orderQuery,orderTransition,normalizeOrderAction} from '../src/orders/domain/orders.ts';
test('order monetary allocation conserves every integer minor unit with deterministic ties',()=>{
  assert.deepEqual(allocateMinor(2n,[1n,1n,1n]),[1n,1n,0n]);
  for(let total=0;total<50;total++)for(const weights of [[1n,2n,3n],[0n,100n,1n],[999999999999999999n,1n]]){const split=allocateMinor(BigInt(total),weights);assert.equal(split.reduce((a,b)=>a+b,0n),BigInt(total));assert.ok(split.every(v=>v>=0n));}
  assert.deepEqual(allocateMinor(0n,[0n,0n]),[0n,0n]);assert.throws(()=>allocateMinor(1n,[0n]),{code:'INVALID'});
});
test('customer order history omits internal SKU and actor authority, while merchant detail is explicit',()=>{
  const order={id:'order',number:'DLC-00000001',checkoutId:'checkout',status:'PLACED',paymentStatus:'DUE',fulfillmentStatus:'UNFULFILLED',paymentMethod:'COD',version:0,createdAt:new Date(),contactName:'Buyer',contactEmail:'buyer@example.test',shippingAddress:{name:'Buyer',line1:'12 Road',city:'Pune',region:'MH',postalCode:'411001',countryCode:'IN',phone:'+919999999999'},shippingMethodName:'Standard',currencyCode:'INR',subtotalMinor:'100',discountMinor:'0',shippingMinor:'0',taxMinor:'0',shippingTaxMinor:'0',taxInclusive:false,totalMinor:'100',amountDueMinor:'100',paidMinor:'0',items:[{id:'line',productId:'product',variantId:'variant',productName:'Product',variantName:'One',sku:'PRIVATE-SKU',quantity:1,unitPriceMinor:'100',subtotalMinor:'100',discountMinor:'0',taxMinor:'0',privateField:'not-public'}],events:[{id:'event',kind:'PLACED',actorId:'private-identity',createdAt:new Date()}],placementKey:'private-key'};
  order.events.push({id:'private-note',kind:'NOTE',actorId:'private-identity',createdAt:new Date(),internalNote:'private content'});
  order.events.push({id:'private-future-event',kind:'INTERNAL_AUDIT',actorId:'private-identity',createdAt:new Date()});
  const customer=orderProjection(order);assert.equal(customer.events.some(e=>e.kind==='INTERNAL_AUDIT'),false);assert.equal(customer.events.some(e=>e.kind==='NOTE'),false);assert.equal(JSON.stringify(customer).includes('PRIVATE-SKU'),false);assert.equal('actorId'in customer.events[0],false);assert.equal('placementKey'in customer,false);assert.equal('privateField'in customer.items[0],false);assert.equal(orderProjection(order,true).items[0].sku,'PRIVATE-SKU');
  assert.throws(()=>orderQuery({limit:101}),{code:'INVALID'});assert.throws(()=>orderQuery({status:'MADE_UP'}),{code:'INVALID'});
});

test('manual fulfillment and COD collection use explicit forward transitions and safe cancellation rules',()=>{
  const order={status:'PLACED',paymentMethod:'COD',paymentStatus:'DUE',fulfillmentStatus:'UNFULFILLED',amountDueMinor:'1233',paidMinor:'0',totalMinor:'1233'};
  assert.throws(()=>orderTransition(order,{kind:'DISPATCH'}),{code:'CONFLICT'});assert.throws(()=>orderTransition(order,{kind:'COLLECT_COD',amountMinor:'1233'}),{code:'CONFLICT'});
  let state={...order,...orderTransition(order,{kind:'READY'})};state={...state,...orderTransition(state,{kind:'DISPATCH'})};
  assert.throws(()=>orderTransition(state,{kind:'CANCEL',reason:'Too late'}),{code:'CONFLICT'});assert.throws(()=>orderTransition(state,{kind:'READY'}),{code:'CONFLICT'});
  state={...state,...orderTransition(state,{kind:'DELIVER'})};assert.equal(state.paymentStatus,'DUE');assert.throws(()=>orderTransition(state,{kind:'COLLECT_COD',amountMinor:'1'}),{code:'CONFLICT'});
  state={...state,...orderTransition(state,{kind:'COLLECT_COD',amountMinor:'1233'})};assert.equal(state.status,'COMPLETED');assert.equal(state.paidMinor,'1233');assert.equal(state.amountDueMinor,'0');
  const cancelled=orderTransition(order,{kind:'CANCEL',reason:'Customer requested'});assert.equal(cancelled.status,'CANCELLED');assert.equal(cancelled.paymentStatus,'VOID');assert.equal(cancelled.restoreInventory,true);
  assert.throws(()=>normalizeOrderAction({kind:'CANCEL',reason:' '}),{code:'INVALID'});assert.throws(()=>normalizeOrderAction({kind:'DISPATCH',carrier:'bad\u0000'}),{code:'INVALID'});assert.throws(()=>normalizeOrderAction({kind:'COLLECT_COD',amountMinor:'1.5'}),{code:'INVALID'});
});
