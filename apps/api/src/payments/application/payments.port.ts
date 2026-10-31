import type {CheckoutContext} from '../../checkout/application/checkout.port.js';
import type {PaymentAttempt,ProviderObservation,ProviderStatus,SimulationScenario} from '../domain/payments.js';
export interface PaymentPort {
 checkHealth?():Promise<void>;
 readonly method:string;readonly idempotentCreation:boolean;
 create(attempt:PaymentAttempt):Promise<{providerOrderId:string}>;
 observe(attempt:PaymentAttempt):Promise<ProviderObservation>;
 close?():Promise<void>|void;
}
export interface DevelopmentPaymentPort extends PaymentPort {simulate(attempt:PaymentAttempt,key:string,event:ProviderStatus):Promise<void>;}
export interface PaymentRepositoryPort {
 checkHealth():Promise<void>;close():Promise<void>;
 prepare(context:CheckoutContext,checkoutId:string,version:number,key:string,scenario:SimulationScenario,delaySeconds:number):Promise<PaymentAttempt>;
 owned(context:CheckoutContext,id:string):Promise<PaymentAttempt>;
 find(id:string):Promise<PaymentAttempt|null>;
 attach(id:string,providerOrderId:string):Promise<PaymentAttempt>;
 unknown(id:string):Promise<PaymentAttempt>;
 record(id:string,observation:ProviderObservation):Promise<PaymentAttempt>;
 finalize(id:string):Promise<PaymentAttempt>;
 review(id:string,code:string):Promise<PaymentAttempt>;
 due(limit:number,storeId?:string):Promise<string[]>;
}
