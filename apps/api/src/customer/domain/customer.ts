import {DomainError} from '../../domain/commerce.js';
export interface AddressInput {name:string;line1:string;line2?:string;city:string;region:string;postalCode:string;countryCode:string;phone:string;isDefault?:boolean;}
export interface CustomerAddress extends Required<AddressInput>{id:string;version:number;}
export function customerAddress(input:AddressInput){
  const result={name:input.name,line1:input.line1,line2:input.line2??'',city:input.city,region:input.region,postalCode:input.postalCode,phone:input.phone,countryCode:input.countryCode.toUpperCase(),isDefault:input.isDefault??false};
  for(const field of ['name','line1','line2','city','region','postalCode','phone'] as const){
    if(typeof result[field]!=='string')throw new DomainError('INVALID','Invalid address.');result[field]=result[field].trim();
    if((field!=='line2'&&!result[field])||result[field].length>(field==='line1'||field==='line2'?200:100)||/[\x00-\x1f]/.test(result[field]))throw new DomainError('INVALID','Address fields are missing or invalid.');
  }
  if(!['IN','US','GB','CA','AU'].includes(result.countryCode)||!/^\+?[0-9 ()-]{7,30}$/.test(result.phone)||typeof result.isDefault!=='boolean')throw new DomainError('INVALID','Unsupported country or invalid phone.');
  return result;
}
