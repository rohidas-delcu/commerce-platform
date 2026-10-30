import {IsString,MinLength,MaxLength,IsInt,Min,IsEmail,IsIn,IsUUID,ValidateIf,Matches,Max,IsArray,ArrayMaxSize,IsOptional,IsObject} from 'class-validator';
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

export class ReserveMediaDto {@IsIn(['image/png','image/jpeg']) contentType!:string; @IsInt() @Min(8) @Max(5242880) size!:number; @IsString() @Matches(/^[a-f0-9]{64}$/) checksum!:string;}
export class SetImagesDto {@IsInt() @Min(0) expectedVersion!:number; @IsArray() @ArrayMaxSize(20) @IsUUID(undefined,{each:true}) assetIds!:string[]; @ValidateIf((_o,v)=>v!==undefined) @IsUUID() primaryAssetId?:string; @ValidateIf((_o,v)=>v!==undefined) @IsObject() altTexts?:Record<string,string>;}
