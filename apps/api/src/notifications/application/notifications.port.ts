import type {NotificationJob,NotificationSource,MailMessage,DeliveryOutcome,IdentityMailContext,OrderMailContext} from '../domain/notifications.js';
export interface NotificationSelector {source:NotificationSource;id:string;}
export interface NotificationRepositoryPort {
  checkHealth():Promise<void>;
  close?():Promise<void>;
  claim(limit:number,provider:string,idempotent:boolean,only?:NotificationSelector):Promise<{jobs:NotificationJob[];recoveredUnknown:number}>;
  identityContext(job:NotificationJob,tokenDigest:string):Promise<IdentityMailContext|null>;
  orderContext(job:NotificationJob):Promise<OrderMailContext|null>;
  finish(job:NotificationJob,outcome:DeliveryOutcome):Promise<boolean>;
}
export interface NotificationTransportPort {readonly provider:string;readonly idempotent:boolean;send(message:MailMessage):Promise<DeliveryOutcome>;close?():void|Promise<void>;}
export interface NotificationCodecPort {decrypt(payload:string):{token:string};digest(token:string):string;}
export interface NotificationLinksPort {identity(context:IdentityMailContext,token:string):string;order(context:OrderMailContext):string;}
export const NOTIFICATION_TRANSPORT=Symbol('NOTIFICATION_TRANSPORT');
