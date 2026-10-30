import assert from 'node:assert/strict';
import test from 'node:test';
import {pricingPolicy,calculateQuote,discountAmount,roundHalfUp,assertPricingReady} from '../src/pricing/domain/pricing.ts';
const policy=()=>pricingPolicy({version:1,shipping:[{id:'standard',name:' Standard ',countries:['IN'],rateMinor:'100',freeAboveMinor:'1000',active:true}],tax:{mode:'EXCLUSIVE',shippingTaxable:true,rates:[{countryCode:'IN',basisPoints:1250}]},payments:{cod:true,simulator:false}});
const input=()=>({subtotalMinor:'999',countryCode:'IN',shippingMethodId:'standard',customerId:'customer',now:new Date()});
const rule=()=>({code:'SAVE',kind:'PERCENTAGE',value:'3333',startsAt:null,expiresAt:null,active:true,maxUses:null,used:0,perCustomerLimit:null,customerUses:0});
test('pricing uses exact discount, shipping threshold and configured exclusive/inclusive tax calculations',()=>{
  const quote=calculateQuote(policy(),{...input(),discount:rule()});assert.equal(quote.discountMinor,'333');assert.equal(quote.shippingMinor,'100');assert.equal(quote.taxMinor,'96');assert.equal(quote.totalMinor,'862');
  assert.equal(calculateQuote(policy(),{...input(),subtotalMinor:'1000'}).shippingMinor,'0');
  assert.equal(calculateQuote(policy(),{...input(),subtotalMinor:'1000',discount:{...rule(),kind:'FIXED',value:'1'}}).shippingMinor,'100','Free shipping threshold uses discounted merchandise.');
  const inclusive=policy();inclusive.tax.mode='INCLUSIVE';inclusive.shipping[0].rateMinor='0';const included=calculateQuote(inclusive,{...input(),subtotalMinor:'11250'});assert.equal(included.taxMinor,'1250');assert.equal(included.totalMinor,'11250');assert.equal(included.taxInclusive,true);
  assert.equal(discountAmount(999n,{...rule(),kind:'FIXED',value:'2000'},'customer',new Date()),999n);assert.equal(roundHalfUp(1n,2n),1n);
  assert.throws(()=>calculateQuote(policy(),{...input(),shippingMethodId:'unknown'}),{code:'CONFLICT'});
});
test('configured tax and coupon eligibility fail closed without inventing jurisdiction rules or usage consumption',()=>{
  const p=policy();p.shipping[0].countries.push('US');assert.throws(()=>calculateQuote(p,{...input(),countryCode:'US'}),{code:'CONFLICT'});assert.throws(()=>assertPricingReady(p),{code:'CONFLICT'});
  for(const changes of [{active:false},{expiresAt:new Date(0)},{startsAt:new Date(Date.now()+10000)},{maxUses:1,used:1},{perCustomerLimit:1,customerUses:1}])assert.throws(()=>discountAmount(999n,{...rule(),...changes},'customer',new Date()),{code:'CONFLICT'});
  assert.throws(()=>discountAmount(999n,{...rule(),perCustomerLimit:1},null,new Date()),{code:'CONFLICT'});
  assert.throws(()=>pricingPolicy({...policy(),tax:{mode:'NONE',rates:[{countryCode:'IN',basisPoints:100}],shippingTaxable:false}}),{code:'INVALID'});
  assert.throws(()=>pricingPolicy({...policy(),shipping:[{...policy().shipping[0],rateMinor:'1.5'}]}),{code:'INVALID'});
  assert.throws(()=>assertPricingReady({...policy(),payments:{cod:false,simulator:false}}),{code:'CONFLICT'});
});
