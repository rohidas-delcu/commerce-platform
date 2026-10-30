import {orderProjection,orderQuery,type OrderQuery} from '../../orders/domain/orders.js';
import {DomainError} from '../../domain/commerce.js';
import {customerAddress} from '../../customer/domain/customer.js';
import {checkoutContact,checkoutProjection,type CheckoutChanges} from '../domain/checkout.js';
import type {CheckoutRepositoryPort,CheckoutContext} from './checkout.port.js';
export class CheckoutService {
  constructor(private repository:CheckoutRepositoryPort){}
  async checkHealth(){if(process.env.DATA_DRIVER==='postgres')await this.repository.checkHealth();}
  async start(c:CheckoutContext,input:{cartId:string;expectedCartVersion:number},key:string){
    if(typeof key!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(key))throw new DomainError('INVALID','Stable Idempotency-Key required.');
    return checkoutProjection(await this.repository.start(c,input.cartId,input.expectedCartVersion,key));
  }
  async get(c:CheckoutContext,id:string){return checkoutProjection(await this.repository.get(c,id));}
  async configure(c:CheckoutContext,id:string,input:CheckoutChanges){
    if(input.contactEmail===undefined&&input.contactName===undefined&&input.shippingMethodId===undefined&&input.shippingAddress===undefined)throw new DomainError('INVALID','At least one checkout setting required.');
    if(input.shippingAddress)customerAddress(input.shippingAddress);
    if(input.contactEmail!==undefined&&input.contactName!==undefined)checkoutContact(input.contactEmail,input.contactName);
    return checkoutProjection(await this.repository.configure(c,id,input));
  }
  async reserve(c:CheckoutContext,id:string,version:number){return checkoutProjection(await this.repository.reserve(c,id,version));}
  async cancel(c:CheckoutContext,id:string,version:number){return checkoutProjection(await this.repository.cancel(c,id,version));}

  async placeCod(c:CheckoutContext,id:string,version:number,key:string){if(typeof key!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(key))throw new DomainError('INVALID','Stable Idempotency-Key required.');return orderProjection(await this.repository.placeCod(c,id,version,key));}
  async orders(c:CheckoutContext,input:OrderQuery){const query=orderQuery(input),found=await this.repository.orders(c,query);return{items:found.slice(0,query.limit).map(order=>orderProjection(order)),limit:query.limit,offset:query.offset,nextOffset:found.length>query.limit?query.offset+query.limit:null};}
  async order(c:CheckoutContext,id:string){return orderProjection(await this.repository.order(c,id));}
}
