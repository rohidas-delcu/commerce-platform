import {DomainError} from '../../domain/commerce.js';
export interface ShippingMethod {id:string;name:string;countries:string[];rateMinor:string;freeAboveMinor:string|null;active:boolean;}
export interface TaxConfiguration {mode:'NONE'|'EXCLUSIVE'|'INCLUSIVE';shippingTaxable:boolean;rates:Array<{countryCode:string;basisPoints:number}>;}
export interface PricingPolicy {version:number;shipping:ShippingMethod[];tax:TaxConfiguration;payments:{cod:boolean;simulator:boolean};}
export interface DiscountRule {code:string;kind:'PERCENTAGE'|'FIXED';value:string;startsAt:Date|null;expiresAt:Date|null;active:boolean;maxUses:number|null;used:number;perCustomerLimit:number|null;customerUses:number;}
export interface QuoteInput {subtotalMinor:string;countryCode:string;shippingMethodId:string;customerId:string|null;now:Date;discount?:DiscountRule;}
const countries=['IN','US','GB','CA','AU'];
export function minorAmount(value:string){if(typeof value!=='string'||!/^\d{1,19}$/.test(value)||BigInt(value)>9223372036854775807n)throw new DomainError('INVALID','Money requires a bounded integer minor-unit string.');return BigInt(value);}
export function roundHalfUp(numerator:bigint,denominator:bigint){if(numerator<0n||denominator<=0n)throw new DomainError('INVALID','Invalid rounding input.');return(numerator+denominator/2n)/denominator;}
export function pricingPolicy(input:PricingPolicy):PricingPolicy {
  if(!Number.isSafeInteger(input.version)||input.version<0||!Array.isArray(input.shipping)||input.shipping.length>20)throw new DomainError('INVALID','Invalid pricing configuration.');
  const ids=new Set<string>();
  const shipping=input.shipping.map(method=>{
    if(!method||typeof method!=='object'||typeof method.id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(method.id)||method.id.length>63||ids.has(method.id)||typeof method.name!=='string'||!method.name.trim()||method.name.length>100||!Array.isArray(method.countries)||method.countries.length<1||method.countries.length>5||new Set(method.countries).size!==method.countries.length||method.countries.some(c=>!countries.includes(c))||typeof method.active!=='boolean')throw new DomainError('INVALID','Invalid shipping method.');
    ids.add(method.id);const rateMinor=minorAmount(method.rateMinor).toString(),freeAboveMinor=method.freeAboveMinor===null?null:minorAmount(method.freeAboveMinor).toString();
    return{id:method.id,name:method.name.trim(),countries:[...method.countries],rateMinor,freeAboveMinor,active:method.active};
  });
  const tax=input.tax;
  if(!tax||!['NONE','EXCLUSIVE','INCLUSIVE'].includes(tax.mode)||typeof tax.shippingTaxable!=='boolean'||!Array.isArray(tax.rates)||tax.rates.length>5||tax.rates.some(r=>!r||typeof r!=='object')||new Set(tax.rates.map(r=>r.countryCode)).size!==tax.rates.length||tax.rates.some(r=>!countries.includes(r.countryCode)||!Number.isSafeInteger(r.basisPoints)||r.basisPoints<0||r.basisPoints>10000)||(tax.mode==='NONE'&&tax.rates.length)||(tax.mode!=='NONE'&&!tax.rates.length))throw new DomainError('INVALID','Explicit tax mode and supported jurisdiction rates required.');
  if(!input.payments||typeof input.payments.cod!=='boolean'||typeof input.payments.simulator!=='boolean')throw new DomainError('INVALID','Invalid payment configuration.');
  return{version:input.version,shipping,tax:{mode:tax.mode,shippingTaxable:tax.shippingTaxable,rates:tax.rates.map(r=>({countryCode:r.countryCode,basisPoints:r.basisPoints}))},payments:{cod:input.payments.cod,simulator:input.payments.simulator}};
}
export interface TaxCalculatorPort {calculate(taxableMinor:bigint,configuration:TaxConfiguration,countryCode:string):{taxMinor:bigint;basisPoints:number;inclusive:boolean};}
export class ConfiguredTaxCalculator implements TaxCalculatorPort {
  calculate(taxableMinor:bigint,configuration:TaxConfiguration,countryCode:string){
    if(configuration.mode==='NONE')return{taxMinor:0n,basisPoints:0,inclusive:false};
    const rate=configuration.rates.find(r=>r.countryCode===countryCode);if(!rate)throw new DomainError('CONFLICT','No configured tax rate for destination.');
    const inclusive=configuration.mode==='INCLUSIVE',basisPoints=rate.basisPoints;
    return{taxMinor:roundHalfUp(taxableMinor*BigInt(basisPoints),inclusive?10000n+BigInt(basisPoints):10000n),basisPoints,inclusive};
  }
}
export function discountAmount(subtotal:bigint,rule:DiscountRule|undefined,customerId:string|null,now:Date){
  if(!rule)return 0n;
  if(!rule.active||(rule.startsAt&&rule.startsAt>now)||(rule.expiresAt&&rule.expiresAt<=now)||(rule.maxUses!==null&&rule.used>=rule.maxUses)||(rule.perCustomerLimit!==null&&(!customerId||rule.customerUses>=rule.perCustomerLimit)))throw new DomainError('CONFLICT','Coupon is unavailable or ineligible.');
  let amount:bigint;
  if(rule.kind==='PERCENTAGE'){
    if(!/^\d{1,5}$/.test(rule.value)||BigInt(rule.value)<1n||BigInt(rule.value)>10000n)throw new DomainError('INVALID','Percentage discount requires 1–10000 basis points.');
    amount=roundHalfUp(subtotal*BigInt(rule.value),10000n);
  }else if(rule.kind==='FIXED')amount=minorAmount(rule.value);else throw new DomainError('INVALID','Unknown discount kind.');
  return amount>subtotal?subtotal:amount;
}
export function calculateQuote(policy:PricingPolicy,input:QuoteInput,taxCalculator:TaxCalculatorPort=new ConfiguredTaxCalculator()){
  const subtotal=minorAmount(input.subtotalMinor);if(!countries.includes(input.countryCode))throw new DomainError('INVALID','Unsupported destination.');
  const method=policy.shipping.find(m=>m.id===input.shippingMethodId&&m.active&&m.countries.includes(input.countryCode));if(!method)throw new DomainError('CONFLICT','Shipping method is unavailable for destination.');
  const discount=discountAmount(subtotal,input.discount,input.customerId,input.now),merchandise=subtotal-discount;
  const shipping=method.freeAboveMinor!==null&&merchandise>=minorAmount(method.freeAboveMinor)?0n:minorAmount(method.rateMinor);
  const tax=taxCalculator.calculate(merchandise+(policy.tax.shippingTaxable?shipping:0n),policy.tax,input.countryCode);
  const total=merchandise+shipping+(tax.inclusive?0n:tax.taxMinor);
  if(total>9223372036854775807n)throw new DomainError('INVALID','Quote exceeds supported amount.');
  return{subtotalMinor:subtotal.toString(),discountMinor:discount.toString(),shippingMinor:shipping.toString(),taxMinor:tax.taxMinor.toString(),totalMinor:total.toString(),taxInclusive:tax.inclusive,taxBasisPoints:tax.basisPoints,shippingMethodId:method.id,policyVersion:policy.version,discountCode:input.discount?.code??null};
}
export function assertPricingReady(policy:PricingPolicy|null){
  if(!policy||!policy.shipping.some(m=>m.active)||(!policy.payments.cod&&!policy.payments.simulator))throw new DomainError('CONFLICT','Configure shipping and an enabled payment method before completing onboarding or publication.');
  if(policy.tax.mode!=='NONE'&&policy.shipping.filter(m=>m.active).some(m=>m.countries.some(c=>!policy.tax.rates.some(r=>r.countryCode===c))))throw new DomainError('CONFLICT','Configure tax treatment for every enabled shipping destination.');
}
