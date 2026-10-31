import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {DomainError} from '../../../domain/commerce.js';
import {assertDevelopmentPayment,type PaymentAttempt,type ProviderObservation} from '../../domain/payments.js';
import type {PaymentPort} from '../../application/payments.port.js';
import type {RefundProviderPort} from '../../../refunds/application/refunds.port.js';
import type {RefundRequest,RefundObservation} from '../../../refunds/domain/refunds.js';

export interface RazorpayTestScope {storeId:string;merchantAccountId:string;keyId:string;keySecret:string;webhookSecret:string;}
export interface RazorpayWebhookEvidence {eventId:string;event:string;storeId:string;merchantAccountId:string;providerPaymentId:string|null;providerRefundId:string|null;}
export class RazorpayBoundaryError extends Error {readonly code='PROVIDER_OUTCOME_UNCERTAIN';constructor(){super('Provider outcome requires authoritative verification or reconciliation.');}}
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const opaque=/^[A-Za-z0-9_-]{1,150}$/;
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new RazorpayBoundaryError();return value as Record<string,unknown>;}
function id(value:unknown){if(typeof value!=='string'||!opaque.test(value))throw new RazorpayBoundaryError();return value;}
function minor(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new RazorpayBoundaryError();return BigInt(value);}
function amountForApi(value:bigint,currency:string){if(currency!=='INR'||value<=0n||value>BigInt(Number.MAX_SAFE_INTEGER))throw new DomainError('INVALID','This test boundary requires positive, safely representable INR minor units.');return Number(value);}
function evidenceId(parts:unknown[]){return'razorpay_'+createHash('sha256').update(JSON.stringify(parts)).digest('hex');}
function validMac(secret:string,body:Uint8Array|string,signature:string){if(typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature))return false;return timingSafeEqual(createHmac('sha256',secret).update(body).digest(),Buffer.from(signature,'hex'));}

/** Candidate boundary only. No API provider selection, live keys, merchant-of-record or bank settlement claim. */
export class RazorpayTestGateway {
 #scope:Readonly<RazorpayTestScope>;
 constructor(scope:RazorpayTestScope,private readonly fetcher:typeof fetch=fetch){
  assertDevelopmentPayment();if(typeof scope.storeId!=='string'||typeof scope.merchantAccountId!=='string'||typeof scope.keyId!=='string'||!uuid.test(scope.storeId)||!uuid.test(scope.merchantAccountId)||!/^rzp_test_[A-Za-z0-9]{6,64}$/.test(scope.keyId)||[scope.keySecret,scope.webhookSecret].some(value=>typeof value!=='string'||!value||value.length>512||/[\s\x00-\x1f\x7f]/.test(value)))throw new DomainError('INVALID','Explicit scoped test credentials and a separate webhook secret are required.');this.#scope=Object.freeze({...scope});
 }
 toJSON(){return{provider:'RAZORPAY_TEST',storeId:this.#scope.storeId,merchantAccountId:this.#scope.merchantAccountId};}
 private scope(storeId:string,method:string){assertDevelopmentPayment();if(method!=='RAZORPAY'||storeId!==this.#scope.storeId)throw new DomainError('FORBIDDEN','Payment provider scope does not match.');}
 private async json(response:Response):Promise<unknown>{
  if(!response.ok){await response.body?.cancel();throw new RazorpayBoundaryError();}
  const reader=response.body?.getReader();if(!reader)throw new RazorpayBoundaryError();const chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>1048576){await reader.cancel();throw new RazorpayBoundaryError();}chunks.push(next.value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}finally{reader.releaseLock();}
 }
 private async request(method:'GET'|'POST',path:string,payload?:Record<string,unknown>){
  assertDevelopmentPayment();try{const response=await this.fetcher('https://api.razorpay.com/v1'+path,{method,redirect:'error',cache:'no-store',headers:{authorization:'Basic '+Buffer.from(this.#scope.keyId+':'+this.#scope.keySecret).toString('base64'),'content-type':'application/json',accept:'application/json'},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(10000)});return await this.json(response);}catch{throw new RazorpayBoundaryError();}
 }
 async createOrder(attempt:PaymentAttempt){
  this.scope(attempt.storeId,attempt.method);const amount=amountForApi(attempt.amountMinor,attempt.currencyCode);if(!uuid.test(attempt.id))throw new DomainError('INVALID','Stable internal payment UUID required.');
  const result=record(await this.request('POST','/orders',{amount,currency:'INR',partial_payment:false,receipt:attempt.id,notes:{payment_attempt_id:attempt.id,store_id:attempt.storeId}}));
  if(minor(result.amount)!==attempt.amountMinor||result.currency!==attempt.currencyCode||result.receipt!==attempt.id)throw new RazorpayBoundaryError();return{providerOrderId:id(result.id)};
 }
 async observePayment(attempt:PaymentAttempt):Promise<ProviderObservation>{
  this.scope(attempt.storeId,attempt.method);amountForApi(attempt.amountMinor,attempt.currencyCode);const orderId=id(attempt.providerOrderId),order=record(await this.request('GET','/orders/'+encodeURIComponent(orderId)));
  if(id(order.id)!==orderId||minor(order.amount)!==attempt.amountMinor||order.currency!==attempt.currencyCode)throw new RazorpayBoundaryError();
  const list=record(await this.request('GET','/orders/'+encodeURIComponent(orderId)+'/payments'));
  if(!Array.isArray(list.items)||!Number.isSafeInteger(list.count)||list.count!==list.items.length)throw new RazorpayBoundaryError();
  const payments=list.items.map(record);for(const item of payments){id(item.id);if(item.order_id!==orderId||item.currency!==attempt.currencyCode)throw new RazorpayBoundaryError();minor(item.amount);if(!['created','authorized','captured','failed','refunded'].includes(String(item.status)))throw new RazorpayBoundaryError();}
  const captured=payments.filter(item=>item.status==='captured');if(captured.length>1)throw new RazorpayBoundaryError();
  if(captured.length===1){const payment=captured[0];if(payment.captured!==true||minor(payment.amount)!==attempt.amountMinor||minor(payment.amount_refunded)!==attempt.refundedMinor||order.status!=='paid'||minor(order.amount_paid)!==attempt.amountMinor||minor(order.amount_due)!==0n)throw new RazorpayBoundaryError();
   const providerPaymentId=id(payment.id);if(attempt.providerPaymentId&&attempt.providerPaymentId!==providerPaymentId)throw new RazorpayBoundaryError();return{eventId:evidenceId([orderId,providerPaymentId,'CAPTURED',payment.amount,payment.currency,payment.amount_refunded]),status:'CAPTURED',providerOrderId:orderId,providerPaymentId,amountMinor:minor(payment.amount).toString(),currencyCode:attempt.currencyCode};
  }
  // An individual failed payment does not make a still-payable Razorpay order terminal.
  if(!['created','attempted'].includes(String(order.status)))throw new RazorpayBoundaryError();
  return{eventId:evidenceId([orderId,'PENDING',payments.map(item=>[item.id,item.status]).sort()]),status:'PENDING',providerOrderId:orderId,providerPaymentId:null,amountMinor:attempt.amountMinor.toString(),currencyCode:attempt.currencyCode};
 }
 checkoutResultIsAuthentic(attempt:PaymentAttempt,input:{orderId:string;paymentId:string;signature:string}){
  this.scope(attempt.storeId,attempt.method);if(!attempt.providerOrderId||input.orderId!==attempt.providerOrderId||typeof input.paymentId!=='string'||!opaque.test(input.paymentId))return false;
  return validMac(this.#scope.keySecret,attempt.providerOrderId+'|'+input.paymentId,input.signature);
 }
 signedWebhook(rawBody:Uint8Array,signature:string):RazorpayWebhookEvidence{
  assertDevelopmentPayment();if(!(rawBody instanceof Uint8Array)||rawBody.byteLength>262144||!validMac(this.#scope.webhookSecret,rawBody,signature))throw new DomainError('FORBIDDEN','Invalid provider webhook signature.');
  let event:Record<string,unknown>;try{event=record(JSON.parse(Buffer.from(rawBody).toString('utf8')));}catch{throw new DomainError('INVALID','Invalid provider webhook envelope.');}
  if(typeof event.event!=='string'||!/^[a-z][a-z0-9_.-]{1,99}$/.test(event.event))throw new DomainError('INVALID','Invalid provider webhook event.');const payload=record(event.payload);let providerPaymentId:string|null=null,providerRefundId:string|null=null;
  if(payload.payment){const payment=record(record(payload.payment).entity);providerPaymentId=id(payment.id);}
  if(payload.refund){const refund=record(record(payload.refund).entity);providerRefundId=id(refund.id);const paymentId=id(refund.payment_id);if(providerPaymentId&&providerPaymentId!==paymentId)throw new DomainError('INVALID','Inconsistent provider webhook references.');providerPaymentId=paymentId;}
  if(!providerPaymentId&&!providerRefundId)throw new DomainError('INVALID','Unsupported provider webhook subject.');
  return{eventId:'razorpay_webhook_'+createHash('sha256').update(rawBody).digest('hex'),event:event.event,storeId:this.#scope.storeId,merchantAccountId:this.#scope.merchantAccountId,providerPaymentId,providerRefundId};
 }
 private refundResponse(value:unknown,request:RefundRequest,expectedId?:string){const result=record(value),providerRefundId=id(result.id);if(expectedId&&providerRefundId!==expectedId||result.payment_id!==request.providerPaymentId||minor(result.amount)!==request.amountMinor||result.currency!==request.currencyCode||result.receipt!==undefined&&result.receipt!==null&&result.receipt!==request.id)throw new RazorpayBoundaryError();return{result,providerRefundId};}
 async createRefund(request:RefundRequest){
  this.scope(request.storeId,request.method);const amount=amountForApi(request.amountMinor,request.currencyCode),paymentId=id(request.providerPaymentId);if(!uuid.test(request.id))throw new DomainError('INVALID','Stable internal refund UUID required.');
  const payment=record(await this.request('GET','/payments/'+encodeURIComponent(paymentId)));if(id(payment.id)!==paymentId||payment.currency!==request.currencyCode||payment.status!=='captured'||payment.captured!==true||minor(payment.amount)-minor(payment.amount_refunded)<request.amountMinor)throw new RazorpayBoundaryError();
  // Receipt is correlation only. The documented endpoint provides no application idempotency guarantee.
  const response=await this.request('POST','/payments/'+encodeURIComponent(paymentId)+'/refund',{amount,speed:'normal',receipt:request.id,notes:{refund_id:request.id,store_id:request.storeId}});return{providerRefundId:this.refundResponse(response,request).providerRefundId};
 }
 async observeRefund(request:RefundRequest):Promise<RefundObservation>{
  this.scope(request.storeId,request.method);amountForApi(request.amountMinor,request.currencyCode);const paymentId=id(request.providerPaymentId),refundId=id(request.providerRefundId),{result}=this.refundResponse(await this.request('GET','/payments/'+encodeURIComponent(paymentId)+'/refunds/'+encodeURIComponent(refundId)),request,refundId);
  const status=result.status==='processed'?'PROCESSED':result.status==='failed'?'FAILED':result.status==='pending'?'PENDING':null;if(!status)throw new RazorpayBoundaryError();return{eventId:evidenceId([paymentId,refundId,status,result.amount,result.currency]),status,providerRefundId:refundId,amountMinor:minor(result.amount).toString(),currencyCode:request.currencyCode};
 }
}
export class RazorpayTestPaymentAdapter implements PaymentPort {
 readonly method='RAZORPAY';readonly idempotentCreation=false;
 constructor(private gateway:RazorpayTestGateway){}
 create(attempt:PaymentAttempt){return this.gateway.createOrder(attempt);}
 observe(attempt:PaymentAttempt){return this.gateway.observePayment(attempt);}
}
export class RazorpayTestRefundAdapter implements RefundProviderPort {
 readonly method='RAZORPAY';readonly idempotentCreation=false;
 constructor(private gateway:RazorpayTestGateway){}
 create(request:RefundRequest){return this.gateway.createRefund(request);}
 observe(request:RefundRequest){return this.gateway.observeRefund(request);}
}
