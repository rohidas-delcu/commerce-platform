import type {NotificationLinksPort} from '../application/notifications.port.js';
import type {IdentityMailContext,OrderMailContext} from '../domain/notifications.js';
export class ConfiguredNotificationLinks implements NotificationLinksPort {
  constructor(private merchant=process.env.MERCHANT_APP_URL??'http://localhost:5173',private storefront=process.env.STOREFRONT_APP_URL??'http://localhost:5173'){
    for(const value of [merchant,storefront]){const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Invalid notification application URL.');}
  }
  identity(context:IdentityMailContext,token:string){const base=context.audience==='customer'?this.storefront:this.merchant,path=context.purpose==='VERIFY'?'verify-email':context.purpose==='RESET'?'reset-password':'accept-invitation';const prefix=context.audience==='customer'?'stores/'+encodeURIComponent(context.storeHandle??'')+'/':'';const url=new URL(prefix+path,base.replace(/\/?$/,'/'));url.searchParams.set('token',token);return url.toString();}
  order(context:OrderMailContext){return new URL('stores/'+encodeURIComponent(context.handle)+'/account/orders/'+context.orderId,this.storefront.replace(/\/?$/,'/')).toString();}
}
