import {IsString,MinLength,MaxLength,IsInt,Min,IsEmail,IsIn,IsUUID,ValidateIf} from 'class-validator';
import {CreateStoreDto} from '../../http/commerce.dto.js';

export class NameDto {@IsString() @MinLength(1) @MaxLength(100) name!:string;}
export class StoreDto extends CreateStoreDto {@IsUUID() merchantId!:string;}
export class SettingsDto {
  @IsInt() @Min(0) expectedVersion!:number;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MinLength(1) @MaxLength(100) name?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MinLength(1) @MaxLength(100) brandingName?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsEmail() @MaxLength(254) contactEmail?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(2) countryCode?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(3) currencyCode?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MinLength(1) @MaxLength(100) timezone?:string;
}
export class VersionDto {@IsInt() @Min(0) expectedVersion!:number;}
export class InviteDto {@IsEmail() @MaxLength(254) email!:string; @ValidateIf((_o,v)=>v!==undefined) @IsUUID() storeId?:string; @IsIn(['MEMBER','STORE_ADMIN','STORE_EDITOR','STORE_VIEWER']) role!:string;}
export class AcceptDto {@IsString() @MinLength(43) @MaxLength(43) token!:string;}
export class StoreRoleDto {@IsIn(['STORE_ADMIN','STORE_EDITOR','STORE_VIEWER']) role!:string;}
export class RoleDto {@IsIn(['ACCOUNT_OWNER','MEMBER']) role!:'ACCOUNT_OWNER'|'MEMBER';}
