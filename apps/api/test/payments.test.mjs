import assert from 'node:assert/strict';
import test from 'node:test';
import {paymentKey,simulationInput,verifiedObservation,assertDevelopmentPayment,paymentProjection} from '../src/payments/domain/payments.ts';
import {DevelopmentPaymentSimulator} from '../src/payments/infrastructure/development-payments.ts';
import {orderTransition} from '../src/orders/domain/orders.ts';
test('payment observations require exact reference, currency, amount and captured receipt',()=>{
 const attempt={amountMinor:9007199254740993n,currencyCode:'INR',providerOrderId:'provider_order',id:'internal',storeId:'private-store',customerId:'private-customer',digest:'private-digest'},observation={status:'CAPTURED',amountMinor:'9007199254740993',currencyCode:'INR',providerOrderId:'provider_order',providerPaymentId:'provider_payment'};
 assert.equal(verifiedObservation(attempt,observation),true);for(const patch of [{amountMinor:'9007199254740992'},{amountMinor:'1.5'},{currencyCode:'USD'},{providerOrderId:'other'},{providerPaymentId:null}])assert.equal(verifiedObservation(attempt,{...observation,...patch}),false);
 assert.equal(paymentProjection(attempt).amountMinor,'9007199254740993');assert.equal('digest'in paymentProjection(attempt),false);assert.equal('customerId'in paymentProjection(attempt),false);assert.throws(()=>paymentKey('bad'));assert.throws(()=>simulationInput('UNKNOWN'));assert.throws(()=>simulationInput('DELAYED',301));
});
test('development payment adapter refuses production and cannot act on a gateway payment',async()=>{
 const previous=process.env.NODE_ENV;try{process.env.NODE_ENV='production';assert.throws(assertDevelopmentPayment,{code:'FORBIDDEN'});const provider=new DevelopmentPaymentSimulator();await assert.rejects(provider.create({method:'SIMULATOR'}),{code:'FORBIDDEN'});process.env.NODE_ENV='test';await assert.rejects(provider.create({method:'RAZORPAY'}),{code:'FORBIDDEN'});}finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
test('paid online fulfillment completes on delivery without COD collection or an implicit refund',()=>{
 const order={status:'PLACED',paymentMethod:'SIMULATOR',paymentStatus:'PAID',fulfillmentStatus:'DISPATCHED',amountDueMinor:'0',paidMinor:'1000',totalMinor:'1000'};const delivered=orderTransition(order,{kind:'DELIVER'});assert.equal(delivered.status,'COMPLETED');assert.equal(delivered.paidMinor,'1000');assert.throws(()=>orderTransition(order,{kind:'COLLECT_COD',amountMinor:'1000'}),{code:'CONFLICT'});assert.throws(()=>orderTransition({...order,fulfillmentStatus:'UNFULFILLED'},{kind:'CANCEL',reason:'Requires refund'}),{code:'CONFLICT'});
});
