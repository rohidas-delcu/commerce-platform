import {Type} from 'class-transformer';
import {IsUUID,IsInt,Min,IsEmail,IsString,MinLength,MaxLength,Matches,ValidateIf,IsObject,ValidateNested} from 'class-validator';
import {AddressDto} from '../../customer/http/customer.dto.js';
export class StartCheckoutDto {@IsUUID() cartId!:string; @IsInt() @Min(0) expectedCartVersion!:number;}
export class CheckoutVersionDto {@IsInt() @Min(0) expectedVersion!:number;}
export class CheckoutSettingsDto extends CheckoutVersionDto {
  @ValidateIf((_o,v)=>v!==undefined) @IsEmail() @MaxLength(254) contactEmail?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MinLength(1) @MaxLength(100) contactName?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(63) shippingMethodId?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsObject() @ValidateNested() @Type(()=>AddressDto) shippingAddress?:AddressDto;
}
