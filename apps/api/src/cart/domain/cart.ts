import {DomainError,publicProduct,type Product} from '../../domain/commerce.js';
import {availableStock} from '../../inventory/domain/inventory.js';
export interface CartLine {variantId:string;quantity:number;priceSeenMinor:string;}
export interface Cart {couponId?:string|null;id:string;storeId:string;customerId:string|null;secretDigest:string|null;status:'ACTIVE'|'MERGED'|'EXPIRED'|'CHECKED_OUT';version:number;expiresAt:Date;mergedIntoId:string|null;lines:CartLine[];}
export interface CartCapability {id:string;digest:string;}
export function cartQuantity(value:number){if(!Number.isInteger(value)||value<1||value>999)throw new DomainError('INVALID','Cart quantity must be 1–999.');return value;}
export function cartVersion(cart:Cart,expected:number){if(cart.status!=='ACTIVE'||cart.expiresAt<=new Date())throw new DomainError('CONFLICT','Cart is unavailable or expired.');if(!Number.isSafeInteger(expected)||expected<0||expected!==cart.version)throw new DomainError('CONFLICT','Cart changed. Refresh before retrying.');}
export function cartProjection(cart:Cart,products:Map<string,Product>,currencyCode:string){
  let subtotal=0n;const validation:Array<{variantId?:string;code:'UNAVAILABLE'|'STOCK_SHORTAGE'|'PRICE_CHANGED'|'COUPON_INVALID'}>=[];
  const items=cart.lines.map(line=>{
    const product=products.get(line.variantId),variant=product?.variants.find(v=>v.id===line.variantId);
    if(!product||product.status!=='ACTIVE'||!variant||variant.active===false){validation.push({variantId:line.variantId,code:'UNAVAILABLE'});return{variantId:line.variantId,quantity:line.quantity,unavailable:true};}
    const priceMinor=variant.priceMinor??product.priceMinor,amount=BigInt(priceMinor)*BigInt(line.quantity);subtotal+=amount;
    if(availableStock(variant.stock,variant.reserved??0)<line.quantity)validation.push({variantId:line.variantId,code:'STOCK_SHORTAGE'});
    if(priceMinor!==line.priceSeenMinor)validation.push({variantId:line.variantId,code:'PRICE_CHANGED'});
    return{variantId:variant.id,productId:product.id,handle:product.handle,name:product.name,variantName:variant.name,quantity:line.quantity,unitPriceMinor:priceMinor,subtotalMinor:amount.toString(),images:publicProduct(product).images};
  });
  return{id:cart.id,status:cart.status,version:cart.version,expiresAt:cart.expiresAt,items,currencyCode,subtotalMinor:subtotal.toString(),validation,valid:cart.status==='ACTIVE'&&cart.expiresAt>new Date()&&!validation.some(v=>v.code!=='PRICE_CHANGED')};
}
