import {DomainError} from '../../domain/commerce.js';
import {minorAmount} from '../../pricing/domain/pricing.js';
import {paymentKey} from '../../payments/domain/payments.js';
export interface ManualRefundInput {expectedVersion:number;key:string;amountMinor:string;reference:string;confirmation:'CASH_RETURNED';}
export interface Refund {id:string;storeId:string;orderId:string;actorId:string;method:string;status:string;amountMinor:bigint;currencyCode:string;reference:string;key:string;digest:string;createdAt:Date;}
export function manualRefundInput(input:ManualRefundInput){paymentKey(input.key);if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||minorAmount(input.amountMinor)<=0n||input.confirmation!=='CASH_RETURNED'||typeof input.reference!=='string'||!input.reference.trim()||input.reference.trim().length>150||/[\x00-\x1f\x7f]/.test(input.reference))throw new DomainError('INVALID','Exact amount, current version and explicit cash-return confirmation/reference required.');return{...input,amountMinor:minorAmount(input.amountMinor).toString(),reference:input.reference.trim()};}
export function refundProjection(row:Refund){return{id:row.id,orderId:row.orderId,method:row.method,status:row.status,amountMinor:row.amountMinor.toString(),currencyCode:row.currencyCode,reference:row.reference,actorId:row.actorId,createdAt:row.createdAt};}
