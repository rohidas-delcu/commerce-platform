import {nextPageOffset} from '../../application/pagination.js';
import {IdentityService,type IdentityRequest} from '../../identity/application/identity.service.js';
import type {IdentityRepositoryFactoryPort,IdentitySecretsPort} from '../../identity/application/identity.port.js';
import {DomainError,normalizeHandle,productQuery,publicProduct} from '../../domain/commerce.js';
import {IdentityError,type BrowserSession,type IdentityAuthorityPort} from '../../identity/domain/identity.js';
import type {CommerceRepository} from '../../application/commerce.port.js';
import type {CustomerRepositoryPort} from './customer.port.js';
import type {AddressInput} from '../domain/customer.js';
export interface CustomerScope {storeId:string;auth:IdentityService;baseCookieName:string;}
export interface CustomerRequest extends IdentityRequest {params:{handle:string};customerScope?:CustomerScope;}
export class CustomerService {
  private dummy:Promise<string>;
  constructor(private commerce:CommerceRepository,private identities:IdentityRepositoryFactoryPort,private repository:CustomerRepositoryPort,private authority:IdentityAuthorityPort,private secrets:IdentitySecretsPort){this.dummy=authority.hash(secrets.secret());}
  async checkHealth(){if(process.env.DATA_DRIVER==='postgres')await this.repository.checkHealth();}
  async scope(handle:string,access:'commerce'|'account'='commerce'):Promise<CustomerScope>{
    if(process.env.DATA_DRIVER!=='postgres')throw new IdentityError(503,'Customer accounts require PostgreSQL.');
    const store=await this.commerce.findStoreByHandle(normalizeHandle(handle));
    if(!store||!store.merchantManaged)throw new DomainError('NOT_FOUND','Store not found.');
    const published=store.merchantStatus==='ACTIVE'&&store.status==='PUBLISHED'&&!store.suspended&&!store.archivedAt;
    if((access==='commerce'&&!published)||(access==='account'&&!published&&!await this.repository.hasAccounts(store.id)))throw new DomainError('NOT_FOUND','Store not found.');
    const baseCookieName='delcu_customer_'+store.id;
    return{storeId:store.id,baseCookieName,auth:new IdentityService(this.identities.scoped(store.id),this.authority,this.secrets,{baseCookieName,rateScope:'store:'+store.id,dummyHash:this.dummy})};
  }
  addresses(scope:CustomerScope,p:BrowserSession){return this.repository.addresses(scope.storeId,p);}
  saveAddress(scope:CustomerScope,p:BrowserSession,input:AddressInput,id?:string,version?:number){return this.repository.saveAddress(scope.storeId,p,input,id,version);}
  async removeAddress(scope:CustomerScope,p:BrowserSession,id:string,version:number){await this.repository.removeAddress(scope.storeId,p,id,version);return{status:'removed'};}
  async wishlist(scope:CustomerScope,p:BrowserSession,input:{limit?:number;offset?:number}){
    const{limit,offset}=productQuery(input),ids=await this.repository.wishlist(scope.storeId,p,limit,offset);
    const items=[];for(const id of ids.slice(0,limit)){const product=await this.commerce.findProduct(scope.storeId,id);if(product?.status==='ACTIVE')items.push(publicProduct(product));}
    return{items,limit,offset,nextOffset:nextPageOffset(ids.length,limit,offset)};
  }
  async favorite(scope:CustomerScope,p:BrowserSession,id:string,add:boolean){await this.repository.favorite(scope.storeId,p,id,add);return{status:add?'saved':'removed'};}
}
