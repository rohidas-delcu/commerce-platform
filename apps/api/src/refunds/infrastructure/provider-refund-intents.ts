import {createHash} from 'node:crypto';
import type {Prisma} from '../../generated/prisma/client.js';
import {DomainError} from '../../domain/commerce.js';
import {assertDevelopmentPayment} from '../../payments/domain/payments.js';
import {providerRefundInput,type ProviderRefundInput} from '../domain/refunds.js';
export async function prepareProviderRefund(tx:Prisma.TransactionClient,storeId:string,target:'ORDER'|'PAYMENT',targetId:string,actorId:string,raw:ProviderRefundInput){
 assertDevelopmentPayment();const input=providerRefundInput(raw),digest=createHash('sha256').update(JSON.stringify({target,targetId,actorId,...input})).digest('hex');
 const prior=await tx.refund.findUnique({where:{storeId_key:{storeId,key:input.key}}});if(prior){if(prior.digest!==digest)throw new DomainError('CONFLICT','Refund key already used for different input.');return prior;}
 const payment=target==='PAYMENT'?await tx.paymentAttempt.findFirst({where:{id:targetId,storeId}}):await tx.paymentAttempt.findFirst({where:{orderId:targetId,storeId}});
 if(!payment)throw new DomainError('NOT_FOUND','Captured payment not found.');
 await tx.$queryRaw`SELECT id FROM "PaymentAttempt" WHERE id=${payment.id}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
 if(payment.method!=='SIMULATOR'||!['SUCCEEDED','CAPTURED','REVIEW_REQUIRED'].includes(payment.status)||!payment.providerPaymentId||!payment.providerOrderId)throw new DomainError('CONFLICT','A supported verified capture is required.');
 if(!await tx.paymentObservation.findFirst({where:{attemptId:payment.id,status:'CAPTURED',providerOrderId:payment.providerOrderId,providerPaymentId:payment.providerPaymentId,amountMinor:payment.amountMinor,currencyCode:payment.currencyCode}}))throw new DomainError('CONFLICT','Matching captured receipt required.');
 if(payment.orderId){await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${payment.orderId}::uuid FOR UPDATE`;const order=await tx.order.findUniqueOrThrow({where:{id:payment.orderId}});if(input.expectedVersion===undefined||order.version!==input.expectedVersion)throw new DomainError('CONFLICT','Current order version required for refund initiation.');}
 const budget=await tx.refund.aggregate({where:{paymentId:payment.id,storeId,status:{not:'FAILED'}},_sum:{amountMinor:true}}),amount=BigInt(input.amountMinor);
 if((budget._sum.amountMinor??0n)+amount>payment.amountMinor)throw new DomainError('CONFLICT','Refund exceeds the captured amount after pending and completed refunds.');
 const refund=await tx.refund.create({data:{storeId,orderId:payment.orderId,paymentId:payment.id,actorId,key:input.key,digest,amountMinor:amount,currencyCode:payment.currencyCode,method:payment.method,status:'CREATED',reference:input.reference,simulationScenario:input.simulationScenario}});
 if(payment.orderId){await tx.order.update({where:{id:payment.orderId},data:{version:{increment:1}}});await tx.orderEvent.create({data:{orderId:payment.orderId,storeId,actorId,kind:'REFUND_REQUESTED',data:{refundId:refund.id,amountMinor:amount.toString()}}});}
 else if(payment.status==='CAPTURED')await tx.paymentAttempt.update({where:{id:payment.id},data:{status:'REVIEW_REQUIRED',reviewCode:'REFUND_IN_PROGRESS'}});
 await tx.identityAudit.create({data:{identityId:actorId,action:'PROVIDER_REFUND_REQUESTED:'+refund.id}});return refund;
}
