export type Money = string;
export interface Store {handle:string;name:string;currencyCode:string;countryCode:string;branding:{name:string;logo:{id:string;url:string;altText:string}|null}}
export interface Variant {id:string;name:string;stock:number;available:boolean;options:Record<string,string>;priceMinor:Money;compareMinor?:Money|null}
export interface Product {id:string;name:string;handle:string;description:string;collection:string;priceMinor:Money;compareMinor?:Money|null;images:Array<{id:string;url:string;altText:string;primary:boolean}>;variants:Variant[];seoTitle?:string;seoDescription?:string}
export interface Page<T> {items:T[];limit:number;offset:number;nextOffset:number|null}
export interface Catalog {products:Product[];store:{handle:string;name:string;currencyCode:string;countryCode:string};pagination:Omit<Page<Product>,'items'>}
export interface Collection {id:string;name:string;handle:string;description:string;featured:boolean}
export interface Collections {collections:Collection[];pagination:Omit<Page<Collection>,'items'>}
export interface CartItem {variantId:string;productId?:string;handle?:string;name?:string;variantName?:string;quantity:number;unitPriceMinor?:Money;subtotalMinor?:Money;unavailable?:boolean;images?:Product['images']}
export interface Cart {id:string;status:string;version:number;expiresAt:string;items:CartItem[];currencyCode:string;subtotalMinor:Money;discountMinor:Money;discountedSubtotalMinor:Money;couponCode:string|null;validation:Array<{variantId?:string;code:string}>;valid:boolean}
export interface Address {name:string;line1:string;line2?:string;city:string;region:string;postalCode:string;countryCode:string;phone:string;isDefault?:boolean}
export interface CheckoutOptions {currencyCode:string;countryCode:string;shipping:Array<{id:string;name:string;countries:string[];rateMinor:Money;freeAboveMinor:Money|null}>;payments:{cod:boolean;simulator:boolean}}
export interface Checkout {id:string;cartId:string;status:'DRAFT'|'READY'|'COMPLETED'|'CANCELLED'|'EXPIRED';version:number;expiresAt:string;orderId:string|null;contactEmail:string;contactName:string;shippingMethodId:string|null;shippingAddress:Address|null;billingAddress:Address|null;billingSameAsShipping:boolean;snapshot:null|{currencyCode:string;shippingMethodName:string;cartVersion:number;totals:{subtotalMinor:Money;discountMinor:Money;shippingMinor:Money;taxMinor:Money;totalMinor:Money;taxInclusive:boolean;discountCode:string|null};items:Array<{productName:string;variantName:string;quantity:number;subtotalMinor:Money}>}}
export interface Order {id:string;number:string;status:string;paymentStatus:string;fulfillmentStatus:string;paymentMethod:string;version:number;createdAt:string;contactEmail:string;contactName:string;currencyCode:string;subtotalMinor:Money;discountMinor:Money;shippingMinor:Money;taxMinor:Money;totalMinor:Money;amountDueMinor:Money;paidMinor:Money;refundedMinor:Money;shippingAddress:Address;items:Array<{id:string;productName:string;variantName:string;quantity:number;subtotalMinor:Money}>;events:Array<{id:string;kind:string;createdAt:string;carrier?:string|null;reference?:string|null}>}
export interface Profile {id:string;name:string;email:string}
export interface Payment {id:string;checkoutId:string;method:string;status:string;amountMinor:Money;currencyCode:string;orderId:string|null;requiresReview:boolean;createdAt:string}

export function money(minor:Money|bigint|number|null|undefined,currency='INR'){
  const raw=BigInt(String(minor??'0'));
  const sign=raw<0n?'-':'';
  const value=raw<0n?-raw:raw;
  const symbol=({INR:'₹',USD:'$',GBP:'£',CAD:'CA$',AUD:'A$'} as Record<string,string>)[currency]||`${currency} `;
  return `${sign}${symbol}${new Intl.NumberFormat('en-IN').format(value/100n)}.${(value%100n).toString().padStart(2,'0')}`;
}
export function key(prefix:string){return `${prefix}-${crypto.randomUUID()}`;}
