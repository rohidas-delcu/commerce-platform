import type {PaymentAttempt} from '../../payments/domain/payments.js';
import type {ManualRefundInput,Refund,ProviderRefundInput,RefundRequest,RefundObservation,RefundProviderStatus} from '../domain/refunds.js';
export interface RefundRepositoryPort {
 manual(storeId:string,orderId:string,actorId:string,input:ManualRefundInput):Promise<Refund>;
 provider(storeId:string,target:'ORDER'|'PAYMENT',targetId:string,actorId:string,input:ProviderRefundInput):Promise<Refund>;
 get(storeId:string,id:string):Promise<Refund>;
 payment(storeId:string,id:string):Promise<PaymentAttempt>;
 payments(storeId:string,limit:number,offset:number):Promise<PaymentAttempt[]>;
 list(storeId:string,orderId:string,limit:number,offset:number):Promise<Refund[]>;
}

export interface RefundProcessingPort {
 checkHealth():Promise<void>;close():Promise<void>;
 request(id:string):Promise<RefundRequest>;
 attach(id:string,providerRefundId:string):Promise<Refund>;
 unknown(id:string):Promise<Refund>;
 record(id:string,observation:RefundObservation):Promise<Refund>;
 finalize(id:string):Promise<Refund>;
 review(id:string,code:string):Promise<Refund>;
 due(limit:number,storeId?:string):Promise<string[]>;
}
export interface RefundProviderPort {
 readonly method:string;readonly idempotentCreation:boolean;
 create(request:RefundRequest):Promise<{providerRefundId:string}>;
 observe(request:RefundRequest):Promise<RefundObservation>;
 close?():Promise<void>|void;
}
export interface DevelopmentRefundPort extends RefundProviderPort {simulate(request:RefundRequest,status:RefundProviderStatus):Promise<void>;}
