import {DomainError} from '../../domain/commerce.js';
import {customerAddress,type AddressInput} from '../../customer/domain/customer.js';
export type OrderStatus='PLACED'|'COMPLETED'|'CANCELLED';
export type PaymentStatus='DUE'|'PAID'|'VOID'|'NOT_REQUIRED'|'PARTIALLY_REFUNDED'|'REFUNDED';
export type FulfillmentStatus='UNFULFILLED'|'READY'|'DISPATCHED'|'DELIVERED'|'CANCELLED';
export interface OrderItem {id:string;productId:string;variantId:string;productName:string;variantName:string;sku:string;quantity:number;unitPriceMinor:string;subtotalMinor:string;discountMinor:string;taxMinor:string;}
export interface OrderEvent {id:string;kind:string;actorId:string;createdAt:Date;carrier?:string|null;reference?:string|null;internalReason?:string|null;internalNote?:string|null;}
export interface Order {
  id:string;number:string;checkoutId:string;status:OrderStatus;paymentStatus:PaymentStatus;fulfillmentStatus:FulfillmentStatus;paymentMethod:'COD'|'SIMULATOR'|'RAZORPAY';version:number;createdAt:Date;
  contactEmail:string;contactName:string;shippingAddress:AddressInput;shippingMethodName:string;currencyCode:string;
  discountCode?:string|null;subtotalMinor:string;discountMinor:string;shippingMinor:string;taxMinor:string;shippingTaxMinor:string;taxInclusive:boolean;totalMinor:string;amountDueMinor:string;paidMinor:string;refundedMinor:string;items:OrderItem[];events:OrderEvent[];
}
export interface OrderQuery {limit?:number;offset?:number;status?:OrderStatus;query?:string;}
export function orderQuery(input:OrderQuery){const limit=input.limit??50,offset=input.offset??0;if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>10000||(input.status&&!['PLACED','COMPLETED','CANCELLED'].includes(input.status))||(input.query!==undefined&&(typeof input.query!=='string'||input.query.length>100)))throw new DomainError('INVALID','Invalid order query.');return{...input,limit,offset};}
export function orderProjection(order:Order,merchant=false){
  return{id:order.id,number:order.number,checkoutId:order.checkoutId,status:order.status,paymentStatus:order.paymentStatus,fulfillmentStatus:order.fulfillmentStatus,paymentMethod:order.paymentMethod,version:order.version,createdAt:order.createdAt,
    contactEmail:order.contactEmail,contactName:order.contactName,shippingAddress:customerAddress(order.shippingAddress),shippingMethodName:order.shippingMethodName,currencyCode:order.currencyCode,
    discountCode:order.discountCode??null,subtotalMinor:order.subtotalMinor,discountMinor:order.discountMinor,shippingMinor:order.shippingMinor,taxMinor:order.taxMinor,shippingTaxMinor:order.shippingTaxMinor,taxInclusive:order.taxInclusive,totalMinor:order.totalMinor,amountDueMinor:order.amountDueMinor,paidMinor:order.paidMinor,refundedMinor:order.refundedMinor??'0',
    items:order.items.map(item=>({id:item.id,productId:item.productId,variantId:item.variantId,productName:item.productName,variantName:item.variantName,quantity:item.quantity,unitPriceMinor:item.unitPriceMinor,subtotalMinor:item.subtotalMinor,discountMinor:item.discountMinor,taxMinor:item.taxMinor,...(merchant?{sku:item.sku}:{})})),
    events:order.events.filter(event=>merchant||['PLACED','READY','DISPATCH','DELIVER','COLLECT_COD','CANCEL','REFUND_RECORDED'].includes(event.kind)).map(event=>({id:event.id,kind:event.kind,createdAt:event.createdAt,...(event.kind==='DISPATCH'?{carrier:event.carrier??null,reference:event.reference??null}:{}),...(merchant?{actorId:event.actorId,internalReason:event.internalReason??null,internalNote:event.internalNote??null}:{})}))};
}
/** Largest remainder allocation; tie order is stable and all integer units are conserved. */
export function allocateMinor(total:bigint,weights:bigint[]){
  if(total<0n||weights.some(w=>w<0n))throw new DomainError('INVALID','Invalid allocation.');
  const sum=weights.reduce((a,b)=>a+b,0n);if(sum===0n){if(total!==0n)throw new DomainError('INVALID','Cannot allocate to zero weight.');return weights.map(()=>0n);}
  const shares=weights.map(weight=>total*weight/sum),remainders=weights.map((weight,index)=>({index,value:total*weight%sum})).sort((a,b)=>a.value>b.value?-1:a.value<b.value?1:a.index-b.index);
  let remaining=total-shares.reduce((a,b)=>a+b,0n);for(const entry of remainders){if(!remaining)break;shares[entry.index]+=1n;remaining--;}
  return shares;
}
export type OrderAction={kind:'READY'}|{kind:'DISPATCH';carrier?:string;reference?:string}|{kind:'DELIVER'}|{kind:'COLLECT_COD';amountMinor:string}|{kind:'CANCEL';reason:string}|{kind:'NOTE';note:string};
export function normalizeOrderAction(action:OrderAction):OrderAction {
  if(action.kind==='DISPATCH'){
    const carrier=(action.carrier??'').trim(),reference=(action.reference??'').trim();if([carrier,reference].some(value=>value.length>100||/[\x00-\x1f]/.test(value)))throw new DomainError('INVALID','Invalid carrier/reference text.');return{kind:action.kind,carrier,reference};
  }
  if(action.kind==='NOTE'){const note=action.note.trim();if(!note||note.length>2000||/[\x00-\x08\x0b-\x1f\x7f]/.test(note))throw new DomainError('INVALID','Internal note required (max2000).');return{kind:action.kind,note};}
  if(action.kind==='CANCEL'){const reason=action.reason.trim();if(!reason||reason.length>500||/[\x00-\x1f]/.test(reason))throw new DomainError('INVALID','Cancellation reason required (max500).');return{kind:action.kind,reason};}
  if(action.kind==='COLLECT_COD'){if(!/^\d{1,19}$/.test(action.amountMinor)||BigInt(action.amountMinor)<1n)throw new DomainError('INVALID','Exact positive cash amount required.');return{kind:action.kind,amountMinor:BigInt(action.amountMinor).toString()};}
  if(action.kind==='READY'||action.kind==='DELIVER')return{kind:action.kind};throw new DomainError('INVALID','Unknown order action.');
}
export function orderTransition(order:Order,action:OrderAction){
  if(order.status!=='PLACED'&&action.kind!=='NOTE')throw new DomainError('CONFLICT','Order is closed.');
  let status=order.status as OrderStatus,paymentStatus=order.paymentStatus,fulfillmentStatus=order.fulfillmentStatus,amountDueMinor=order.amountDueMinor,paidMinor=order.paidMinor,notification:string|null=null,restoreInventory=false;
  switch(action.kind){
    case 'NOTE':break;
    case 'READY':if(fulfillmentStatus!=='UNFULFILLED')throw new DomainError('CONFLICT','Order cannot be marked ready.');fulfillmentStatus='READY';break;
    case 'DISPATCH':if(fulfillmentStatus!=='READY')throw new DomainError('CONFLICT','Mark order ready before dispatch.');fulfillmentStatus='DISPATCHED';notification='ORDER_DISPATCHED';break;
    case 'DELIVER':if(fulfillmentStatus!=='DISPATCHED')throw new DomainError('CONFLICT','Only dispatched orders can be delivered.');fulfillmentStatus='DELIVERED';if(['NOT_REQUIRED','PAID'].includes(paymentStatus))status='COMPLETED';notification='ORDER_DELIVERED';break;
    case 'COLLECT_COD':if(order.paymentMethod!=='COD'||paymentStatus!=='DUE'||fulfillmentStatus!=='DELIVERED'||BigInt(action.amountMinor)!==BigInt(amountDueMinor))throw new DomainError('CONFLICT','Record the exact outstanding COD amount after delivery.');paymentStatus='PAID';paidMinor=order.totalMinor;amountDueMinor='0';status='COMPLETED';notification='PAYMENT_CONFIRMATION';break;
    case 'CANCEL':if(!['UNFULFILLED','READY'].includes(fulfillmentStatus)||!['DUE','NOT_REQUIRED'].includes(paymentStatus))throw new DomainError('CONFLICT','Only unpaid, undispatched orders can be cancelled.');status='CANCELLED';paymentStatus='VOID';fulfillmentStatus='CANCELLED';amountDueMinor='0';notification='ORDER_CANCELLED';restoreInventory=true;break;
  }
  return{status,paymentStatus,fulfillmentStatus,amountDueMinor,paidMinor,notification,restoreInventory};
}
