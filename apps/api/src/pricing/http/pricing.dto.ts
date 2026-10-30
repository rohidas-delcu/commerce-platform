import {Type} from 'class-transformer';
import {IsString,MinLength,MaxLength,Matches,IsArray,ArrayMinSize,ArrayMaxSize,ArrayUnique,IsIn,IsBoolean,IsInt,Min,Max,IsObject,ValidateNested,ValidateIf} from 'class-validator';
import {AddressDto} from '../../customer/http/customer.dto.js';
export class ShippingMethodDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(63) id!:string;
  @IsString() @MinLength(1) @MaxLength(100) name!:string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @ArrayUnique() @IsIn(['IN','US','GB','CA','AU'],{each:true}) countries!:string[];
  @IsString() @Matches(/^\d{1,19}$/) rateMinor!:string;
  @ValidateIf((_o,v)=>v!==null) @IsString() @Matches(/^\d{1,19}$/) freeAboveMinor!:string|null;
  @IsBoolean() active!:boolean;
}
export class TaxRateDto {@IsIn(['IN','US','GB','CA','AU']) countryCode!:string; @IsInt() @Min(0) @Max(10000) basisPoints!:number;}
export class TaxDto {@IsIn(['NONE','EXCLUSIVE','INCLUSIVE']) mode!:'NONE'|'EXCLUSIVE'|'INCLUSIVE'; @IsBoolean() shippingTaxable!:boolean; @IsArray() @ArrayMaxSize(5) @ValidateNested({each:true}) @Type(()=>TaxRateDto) rates!:TaxRateDto[];}
export class PaymentSettingsDto {@IsBoolean() cod!:boolean; @IsBoolean() simulator!:boolean;}
export class PricingDto {
  @IsInt() @Min(0) version!:number;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>ShippingMethodDto) shipping!:ShippingMethodDto[];
  @IsObject() @ValidateNested() @Type(()=>TaxDto) tax!:TaxDto;
  @IsObject() @ValidateNested() @Type(()=>PaymentSettingsDto) payments!:PaymentSettingsDto;
}
export class QuoteDto {@IsInt() @Min(0) expectedVersion!:number; @IsString() @MinLength(1) @MaxLength(63) shippingMethodId!:string; @IsObject() @ValidateNested() @Type(()=>AddressDto) shippingAddress!:AddressDto;}
