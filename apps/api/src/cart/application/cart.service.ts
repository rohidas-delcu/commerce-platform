import {couponCode} from '../../pricing/domain/coupons.js';
import {calculateQuote,discountAmount} from '../../pricing/domain/pricing.js';
import {customerAddress,type AddressInput} from '../../customer/domain/customer.js';
import {randomUUID} from 'node:crypto';
import type {CommerceRepository} from '../../application/commerce.port.js';
import type {IdentitySecretsPort} from '../../identity/application/identity.port.js';
import type {BrowserSession} from '../../identity/domain/identity.js';
import {cartProjection,cartQuantity,type Cart,type CartCapability} from '../domain/cart.js';
import type {CartContext,CartRepositoryPort} from './cart.port.js';
import {DomainError,type Product} from '../../domain/commerce.js';
export class CartService {
  constructor(private repository:CartRepositoryPort,private commerce:CommerceRepository,private secrets:IdentitySecretsPort){}
  async checkHealth(){if(process.env.DATA_DRIVER==='postgres')await this.repository.checkHealth();}
  capability(cookie:string|undefined,storeId:string):CartCapability|null{
    const name=(process.env.NODE_ENV==='production'?'__Host-':'')+'delcu_cart_'+storeId;
    const cookies=(cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));if(cookies.length!==1)return null;
    const match=/^([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\.([A-Za-z0-9_-]{43})$/.exec(cookies[0].slice(name.length+1));return match?{id:match[1],digest:this.secrets.digest(match[2])}:null;
  }
  context(storeId:string,principal:BrowserSession,cookie:string|undefined):CartContext{return{storeId,principal,capability:this.capability(cookie,storeId)};}
  private async projection(cart:Cart){
    const store=await this.commerce.findStoreById(cart.storeId);if(!store)throw new DomainError('NOT_FOUND','Store not found.');
    const products=new Map<string,Product>();for(const product of await this.commerce.productsForVariants(cart.storeId,cart.lines.map(line=>line.variantId)))for(const variant of product.variants)if(cart.lines.some(line=>line.variantId===variant.id))products.set(variant.id,product);
    const view=cartProjection(cart,products,store.currencyCode);let discount=0n,code:string|null=null;
    if(cart.couponId){const rule=await this.commerce.pricing.couponRule(cart.storeId,cart.couponId,cart.customerId,cart.id);code=rule?.code??null;
      try{if(!rule)throw new DomainError('CONFLICT','Coupon unavailable.');discount=discountAmount(BigInt(view.subtotalMinor),rule,cart.customerId,new Date());}
      catch(error){if(!(error instanceof DomainError)||error.code!=='CONFLICT')throw error;view.validation.push({code:'COUPON_INVALID'});view.valid=false;}
    }
    return{...view,couponCode:code,discountMinor:discount.toString(),discountedSubtotalMinor:(BigInt(view.subtotalMinor)-discount).toString()};
  }
  async create(context:CartContext){const secret=this.secrets.secret(),id=randomUUID();const result=await this.repository.create(context,{id,digest:this.secrets.digest(secret)});return{cart:await this.projection(result.cart),guestCookie:result.createdGuest?id+'.'+secret:null};}
  async current(context:CartContext){return this.projection(await this.repository.current(context));}
  async update(context:CartContext,version:number,operation:Parameters<CartRepositoryPort['update']>[2]){if(operation.type==='set')cartQuantity(operation.quantity);if(operation.type==='coupon'&&operation.code!==null)operation={...operation,code:couponCode(operation.code)};return this.projection(await this.repository.update(context,version,operation));}
  async merge(context:CartContext,version:number,guestVersion:number){return this.projection(await this.repository.merge(context,version,guestVersion));}

  async quote(context:CartContext,input:{expectedVersion:number;shippingMethodId:string;shippingAddress:AddressInput}){
    const raw=await this.repository.current(context),cart=await this.projection(raw);if(cart.version!==input.expectedVersion||!cart.valid||!cart.items.length)throw new DomainError('CONFLICT','Cart changed, empty or invalid.');
    const address=customerAddress(input.shippingAddress),policy=await this.commerce.pricing.policy(context.storeId);if(!policy)throw new DomainError('CONFLICT','Store pricing is not configured.');
    const coupon=raw.couponId?await this.commerce.pricing.couponRule(context.storeId,raw.couponId,raw.customerId,raw.id):null;
    if(raw.couponId&&!coupon)throw new DomainError('CONFLICT','Coupon unavailable.');
    const totals=calculateQuote(policy,{discount:coupon??undefined,subtotalMinor:cart.subtotalMinor,countryCode:address.countryCode,shippingMethodId:input.shippingMethodId,customerId:context.principal.identityId,now:new Date()});
    return{...totals,currencyCode:cart.currencyCode,cartVersion:cart.version,estimate:true};
  }
}
