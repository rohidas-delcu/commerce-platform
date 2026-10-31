import type {ManualRefundInput,Refund} from '../domain/refunds.js';
export interface RefundRepositoryPort {
 manual(storeId:string,orderId:string,actorId:string,input:ManualRefundInput):Promise<Refund>;
 list(storeId:string,orderId:string,limit:number,offset:number):Promise<Refund[]>;
}
