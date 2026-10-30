import assert from 'node:assert/strict';
import test from 'node:test';
import {couponMetadata,couponCode} from '../src/pricing/domain/coupons.ts';
test('coupon metadata normalizes codes and enforces exact values, validity windows and bounded limits',()=>{
  const input={code:' save_one ',kind:'PERCENTAGE',value:'2500',active:true,startsAt:null,expiresAt:null,maxUses:1,perCustomerLimit:1,restoreOnCancellation:false};assert.equal(couponMetadata(input).code,'SAVE_ONE');assert.equal(couponCode('abc'),'ABC');
  for(const changes of [{value:'10001'},{value:'0'},{value:'1.5'},{maxUses:0},{perCustomerLimit:-1},{startsAt:new Date(2000),expiresAt:new Date(1000)},{expiresAt:new Date('bad')}])assert.throws(()=>couponMetadata({...input,...changes}),{code:'INVALID'});
  assert.equal(couponMetadata({...input,kind:'FIXED',value:'999999999999999999'}).value,'999999999999999999');
});
