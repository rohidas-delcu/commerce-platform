export type NotificationSource='identity'|'order'|'payment';
export interface NotificationJob {source:NotificationSource;id:string;messageId:string;leaseToken:string;attempts:number;createdAt:Date;recipient?:string;purpose:string;scopeKey?:string;encryptedPayload?:string;storeId?:string;orderId?:string;paymentId?:string;}
export interface MailMessage {id:string;to:string;subject:string;text:string;}
export type DeliveryOutcome={kind:'accepted';providerMessageId:string}|{kind:'retryable'|'rejected'|'unknown'|'cancelled';code:string};
export interface IdentityMailContext {purpose:'VERIFY'|'RESET'|'INVITE';audience:'merchant'|'customer';storeHandle:string|null;name:string;expiresAt:Date;}
export interface OrderMailContext {recipient:string;name:string;handle:string;number:string;orderId:string;currencyCode:string;totalMinor:string;paidMinor:string;refundedMinor:string;paymentMethod:string;carrier:string|null;reference:string|null;}
export function retryDelayMs(attempt:number){return Math.min(3600000,30000*2**Math.max(0,Math.min(10,attempt-1)));}
export function moneyText(minor:string,currency:string){if(!/^\d{1,19}$/.test(minor)||!['INR','USD','GBP','CAD','AUD'].includes(currency))throw new Error('Invalid notification amount.');const value=BigInt(minor);return currency+' '+(value/100n).toString()+'.'+(value%100n).toString().padStart(2,'0');}
export function safeLine(value:string){return value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,150);}

export interface PaymentMailContext {recipient:string;name:string;handle:string;paymentId:string;method:string;currencyCode:string;amountMinor:string;refundedMinor:string;}
