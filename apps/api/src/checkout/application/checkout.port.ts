import type {Order,OrderQuery} from '../../orders/domain/orders.js';
import type {BrowserSession} from '../../identity/domain/identity.js';
import type {Checkout,CheckoutChanges} from '../domain/checkout.js';
export interface CheckoutContext {storeId:string;principal:BrowserSession;}
export interface CheckoutRepositoryPort {
  checkHealth():Promise<void>;
  placeCod(context:CheckoutContext,id:string,version:number,key:string):Promise<Order>;
  orders(context:CheckoutContext,input:OrderQuery&{limit:number;offset:number}):Promise<Order[]>;
  order(context:CheckoutContext,id:string):Promise<Order>;
  start(context:CheckoutContext,cartId:string,cartVersion:number,key:string):Promise<Checkout>;
  get(context:CheckoutContext,id:string):Promise<Checkout>;
  configure(context:CheckoutContext,id:string,input:CheckoutChanges):Promise<Checkout>;
  reserve(context:CheckoutContext,id:string,version:number):Promise<Checkout>;
  cancel(context:CheckoutContext,id:string,version:number):Promise<Checkout>;
}
