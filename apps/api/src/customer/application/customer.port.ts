import type {BrowserSession} from '../../identity/domain/identity.js';
import type {AddressInput,CustomerAddress} from '../domain/customer.js';
export interface CustomerRepositoryPort {
  checkHealth():Promise<void>;
  addresses(storeId:string,p:BrowserSession):Promise<CustomerAddress[]>;
  saveAddress(storeId:string,p:BrowserSession,input:AddressInput,id?:string,version?:number):Promise<CustomerAddress>;
  removeAddress(storeId:string,p:BrowserSession,id:string,version:number):Promise<void>;
  wishlist(storeId:string,p:BrowserSession,limit:number,offset:number):Promise<string[]>;
  favorite(storeId:string,p:BrowserSession,productId:string,add:boolean):Promise<void>;
}
