import type {BrowserSession} from '../../identity/domain/identity.js';
import type {Cart,CartCapability} from '../domain/cart.js';
export interface CartContext {storeId:string;principal:BrowserSession;capability:CartCapability|null;}
export interface CartRepositoryPort {
  checkHealth():Promise<void>;
  create(context:CartContext,guest:{id:string;digest:string}):Promise<{cart:Cart;createdGuest:boolean}>;
  current(context:CartContext):Promise<Cart>;
  update(context:CartContext,version:number,operation:{type:'set';variantId:string;quantity:number}|{type:'remove';variantId:string}|{type:'clear'}|{type:'refresh'}):Promise<Cart>;
  merge(context:CartContext,version:number,guestVersion:number):Promise<Cart>;
}
