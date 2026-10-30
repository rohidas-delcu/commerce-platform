import {createHash} from 'node:crypto';
import {CommerceService} from '../../application/commerce.service.js';
import {normalizeHandle} from '../../domain/commerce.js';
import type {IdentitySecretsPort} from "../../identity/application/identity.port.js";
import {IdentityError, emailAddress} from '../../identity/domain/identity.js';
import {locale, type Permission} from '../domain/access.js';
import type {MerchantRepositoryPort, MerchantPrincipal, StoreSettings} from './merchant.port.js';
export class MerchantService {
  constructor(private repository:MerchantRepositoryPort, private secrets:IdentitySecretsPort){}
  async checkHealth(){if(process.env.DATA_DRIVER==='postgres')await this.repository.checkHealth();}
  accountStatus(p:MerchantPrincipal,id:string,suspended:boolean){return this.repository.accountStatus(p,id,suspended);}
  storeStatus(p:MerchantPrincipal,id:string,operation:"suspend"|"resume"|"archive"){return this.repository.storeStatus(p,id,operation);}
  createAccount(p:MerchantPrincipal,name:string){if(!name.trim())throw new IdentityError(400,'Name required.');return this.repository.createAccount(p,name.trim());}
  accounts(p:MerchantPrincipal){return this.repository.accounts(p);}
  createStore(p:MerchantPrincipal,merchantId:string,input:{name:string;handle:string;countryCode?:string;currencyCode?:string},key:string){
    if(!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key))throw new IdentityError(400,'Idempotency-Key of 8–100 safe characters required.');
    const data={name:input.name.trim(),handle:normalizeHandle(input.handle),countryCode:(input.countryCode??'IN').toUpperCase(),currencyCode:(input.currencyCode??'INR').toUpperCase()};
    if(!data.name)throw new IdentityError(400,'Name required.');locale(data.countryCode,data.currencyCode);
    const digest=createHash('sha256').update(JSON.stringify({merchantId,...data})).digest('hex');
    return this.repository.createStore(p,merchantId,data,key,digest);
  }
  stores(p:MerchantPrincipal){return this.repository.stores(p);}
  store(p:MerchantPrincipal,id:string){return this.repository.withStore(p,id,'store.read',async(_repo,store)=>store);}
  settings(p:MerchantPrincipal,id:string,input:StoreSettings){
    const changes={...input};
    for(const field of ['name','brandingName','contactEmail'] as const)if(changes[field]!==undefined){changes[field]=changes[field]!.trim();if(!changes[field])throw new IdentityError(400,'Settings fields cannot be blank.');}
    if(changes.timezone){try{new Intl.DateTimeFormat('en',{timeZone:changes.timezone});}catch{throw new IdentityError(400,'Invalid IANA timezone.');}}
    return this.repository.settings(p,id,changes);
  }
  complete(p:MerchantPrincipal,id:string,version:number){return this.repository.complete(p,id,version);}
  publish(p:MerchantPrincipal,id:string,published:boolean){return this.repository.publication(p,id,published);}
  members(p:MerchantPrincipal,id:string){return this.repository.members(p,id);}
  membership(p:MerchantPrincipal,id:string,identityId:string,role:'ACCOUNT_OWNER'|'MEMBER'|null){return this.repository.membership(p,id,identityId,role);}

  invite(p:MerchantPrincipal,merchantId:string,input:{storeId?:string;email:string;role:string}) {
    let email:string;try{email=emailAddress(input.email);}catch{throw new IdentityError(400,'Invalid email.');}
    const roles=input.storeId?['STORE_ADMIN','STORE_EDITOR','STORE_VIEWER']:['MEMBER'];
    if(!roles.includes(input.role))throw new IdentityError(400,'Invalid invitation role.');
    const token=this.secrets.secret();
    return this.repository.invite(p,merchantId,input.storeId??null,email,input.role,this.secrets.digest(token),this.secrets.encryptMail({token}));
  }
  accept(p:MerchantPrincipal,token:string){return this.repository.accept(p,this.secrets.digest(token));}
  invitations(p:MerchantPrincipal,id:string){return this.repository.invitations(p,id);}
  revokeInvitation(p:MerchantPrincipal,merchantId:string,id:string){return this.repository.revokeInvitation(p,merchantId,id);}
  storeMember(p:MerchantPrincipal,storeId:string,identityId:string,role:string|null){
    if(role!==null && !['STORE_ADMIN','STORE_EDITOR','STORE_VIEWER'].includes(role))throw new IdentityError(400,'Invalid store role.');
    return this.repository.storeMember(p,storeId,identityId,role);
  }
  private commerce<T>(p:MerchantPrincipal,id:string,permission:Permission,work:(service:CommerceService)=>Promise<T>){
    return this.repository.withStore(p,id,permission,repo=>work(new CommerceService(repo,{assertStoreAccess:async(store,subject)=>{
      if(store.id!==id || subject!==p.identityId)throw new IdentityError(404,'Store not found.');
    }})));
  }
  products(p:MerchantPrincipal,id:string,input:Parameters<CommerceService['queryProducts']>[2]={}){return this.commerce(p,id,'store.read',service=>service.queryProducts(p.identityId!,id,input));}
  productDetail(p:MerchantPrincipal,id:string,productId:string){return this.commerce(p,id,'store.read',service=>service.productDetail(p.identityId!,id,productId));}
  productState(p:MerchantPrincipal,id:string,productId:string,state:'DRAFT'|'ARCHIVED'){return this.commerce(p,id,'catalog.write',service=>service.productState(p.identityId!,id,productId,state));}
  createProduct(p:MerchantPrincipal,id:string,input:Parameters<CommerceService['createProduct']>[2]){return this.commerce(p,id,'catalog.write',service=>service.createProduct(p.identityId!,id,input));}
  updateProduct(p:MerchantPrincipal,id:string,productId:string,input:Parameters<CommerceService['updateProduct']>[3]){return this.commerce(p,id,'catalog.write',service=>service.updateProduct(p.identityId!,id,productId,input));}
  activateProduct(p:MerchantPrincipal,id:string,productId:string){return this.commerce(p,id,'catalog.write',service=>service.activateProduct(p.identityId!,id,productId));}
  stock(p:MerchantPrincipal,id:string,variantId:string,input:Parameters<CommerceService['adjustStock']>[3]){return this.commerce(p,id,'inventory.write',service=>service.adjustStock(p.identityId!,id,variantId,input));}

  createVariant(p:MerchantPrincipal,id:string,productId:string,input:Parameters<CommerceService['createVariant']>[3]){return this.commerce(p,id,'catalog.write',service=>service.createVariant(p.identityId!,id,productId,input));}
  updateVariant(p:MerchantPrincipal,id:string,productId:string,variantId:string,input:Parameters<CommerceService['updateVariant']>[4]){return this.commerce(p,id,'catalog.write',service=>service.updateVariant(p.identityId!,id,productId,variantId,input));}
  movements(p:MerchantPrincipal,id:string){return this.commerce(p,id,'store.read',service=>service.movements(p.identityId!,id));}
}
