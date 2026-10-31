import {createHash} from 'node:crypto';
import {DomainError} from '../../domain/commerce.js';
import {normalizeOrderAction,orderTransition,type OrderAction} from '../domain/orders.js';
import type {CommerceRepository} from '../../application/commerce.port.js';
import type {PrismaClient,Prisma} from '../../generated/prisma/client.js';
import type {OrderRepositoryPort} from '../application/orders.port.js';
import type {Order,OrderQuery} from '../domain/orders.js';
import type {AddressInput} from '../../customer/domain/customer.js';
export const orderInclude={items:{orderBy:{variantId:'asc' as const}},events:{orderBy:[{createdAt:'asc' as const},{id:'asc' as const}]}};
type Row=Prisma.OrderGetPayload<{include:typeof orderInclude}>;
export function orderDomain(row:Row):Order{const tax=row.taxSnapshot&&typeof row.taxSnapshot==='object'&&!Array.isArray(row.taxSnapshot)?row.taxSnapshot:{};return{discountCode:typeof tax.discountCode==='string'?tax.discountCode:null,id:row.id,number:row.number,checkoutId:row.checkoutId,status:row.status as Order['status'],paymentStatus:row.paymentStatus as Order['paymentStatus'],fulfillmentStatus:row.fulfillmentStatus as Order['fulfillmentStatus'],paymentMethod:row.paymentMethod as Order['paymentMethod'],version:row.version,createdAt:row.createdAt,contactEmail:row.contactEmail,contactName:row.contactName,shippingAddress:row.shippingAddress as unknown as AddressInput,billingAddress:row.billingAddress as AddressInput|null,billingAddressSource:row.billingAddressSource as import('../../customer/domain/customer.js').BillingAddressSource,shippingMethodName:row.shippingMethodName,currencyCode:row.currencyCode,subtotalMinor:row.subtotalMinor.toString(),discountMinor:row.discountMinor.toString(),shippingMinor:row.shippingMinor.toString(),taxMinor:row.taxMinor.toString(),shippingTaxMinor:row.shippingTaxMinor.toString(),taxInclusive:row.taxInclusive,totalMinor:row.totalMinor.toString(),amountDueMinor:row.amountDueMinor.toString(),paidMinor:row.paidMinor.toString(),refundedMinor:row.refundedMinor.toString(),items:row.items.map(item=>({...item,unitPriceMinor:item.unitPriceMinor.toString(),subtotalMinor:item.subtotalMinor.toString(),discountMinor:item.discountMinor.toString(),taxMinor:item.taxMinor.toString()})),events:row.events.map(event=>{const data=event.data&&typeof event.data==='object'&&!Array.isArray(event.data)?event.data:{};return{id:event.id,kind:event.kind,actorId:event.actorId,createdAt:event.createdAt,carrier:typeof data.carrier==='string'?data.carrier:null,reference:typeof data.reference==='string'?data.reference:null,internalReason:typeof data.reason==='string'?data.reason:null,internalNote:typeof data.note==='string'?data.note:null};})};}
export class PrismaOrderReadRepository implements OrderRepositoryPort {
  constructor(private db:PrismaClient|Prisma.TransactionClient,private adjustStock:(tx:Prisma.TransactionClient,input:Parameters<CommerceRepository['adjustStock']>[0])=>ReturnType<CommerceRepository['adjustStock']>){}
  async find(storeId:string,id:string){const row=await this.db.order.findFirst({where:{id,storeId},include:orderInclude});return row?orderDomain(row):null;}
  async list(storeId:string,input:OrderQuery&{limit:number;offset:number}){return(await this.db.order.findMany({where:{storeId,...(input.status?{status:input.status}:{}),...(input.query?{OR:[{number:{contains:input.query,mode:'insensitive'}},{contactEmail:{contains:input.query,mode:'insensitive'}},{contactName:{contains:input.query,mode:'insensitive'}}]}:{})},orderBy:[{createdAt:'desc'},{id:'asc'}],take:input.limit+1,skip:input.offset,include:orderInclude})).map(orderDomain);}

  private transaction<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>){return '$transaction'in this.db?this.db.$transaction(work):work(this.db);}
  command(storeId:string,id:string,input:{expectedVersion:number;key:string;action:OrderAction},actor:string){return this.transaction(async tx=>{
    const action=normalizeOrderAction(input.action),digest=createHash('sha256').update(JSON.stringify({expectedVersion:input.expectedVersion,action})).digest('hex');
    await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${storeId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
    const row=await tx.order.findFirst({where:{id,storeId},include:orderInclude});if(!row)throw new DomainError('NOT_FOUND','Order not found.');
    const previous=await tx.orderCommand.findUnique({where:{orderId_key:{orderId:id,key:input.key}}});if(previous){if(previous.digest!==digest)throw new DomainError('CONFLICT','Command key already used for different input.');return orderDomain(row);}
    if(row.version!==input.expectedVersion)throw new DomainError('CONFLICT','Order changed. Refresh before retrying.');
    if(['READY','DISPATCH'].includes(action.kind)&&await tx.refund.findFirst({where:{orderId:id,storeId,status:{in:['CREATED','PENDING','UNKNOWN','CONFIRMED','REVIEW_REQUIRED']}}}))throw new DomainError('CONFLICT','Resolve pending refunds before starting fulfillment.');
    const transition=orderTransition(orderDomain(row),action);
    if(transition.restoreInventory){
      for(const item of row.items){
        await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id=${item.variantId}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
        const variant=await tx.productVariant.findFirstOrThrow({where:{id:item.variantId,storeId}});
        await this.adjustStock(tx,{storeId,variantId:variant.id,after:variant.stock+item.quantity,reason:'ORDER_CANCELLED',note:'Cancelled order '+id,actorSubjectId:actor});
      }
    }
    if(action.kind==='CANCEL'){const redemption=await tx.couponRedemption.findFirst({where:{orderId:id,storeId,restoreOnCancellation:true}});if(redemption)await tx.couponRedemptionRelease.create({data:{orderId:id,storeId,reason:'ORDER_CANCELLED'}});}
    const data=action.kind==='DISPATCH'?{carrier:action.carrier??'',reference:action.reference??''}:action.kind==='CANCEL'?{reason:action.reason}:action.kind==='NOTE'?{note:action.note}:{};
    await tx.orderCommand.create({data:{orderId:id,storeId,key:input.key,digest}});
    await tx.orderEvent.create({data:{orderId:id,storeId,kind:action.kind,actorId:actor,data}});
    if(transition.notification)await tx.orderNotification.create({data:{orderId:id,storeId,kind:transition.notification,key:id+':'+transition.notification}});
    const saved=await tx.order.update({where:{id,version:input.expectedVersion},data:{status:transition.status,paymentStatus:transition.paymentStatus,fulfillmentStatus:transition.fulfillmentStatus,amountDueMinor:BigInt(transition.amountDueMinor),paidMinor:BigInt(transition.paidMinor),version:{increment:1}},include:orderInclude});
    await tx.identityAudit.create({data:{identityId:actor,action:'ORDER_'+action.kind+':'+id}});return orderDomain(saved);
  });}
}
