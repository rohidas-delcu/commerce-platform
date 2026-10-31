import {Type} from 'class-transformer';
import {IsString,Matches,MaxLength,IsIn,IsBoolean,IsInt,Min,Max,ValidateIf,IsISO8601} from 'class-validator';
export class CouponOptionalDto {
  @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() active?:boolean;
  @ValidateIf((_o,v)=>v!==undefined&&v!==null) @IsISO8601({strict:true}) startsAt?:string|null;
  @ValidateIf((_o,v)=>v!==undefined&&v!==null) @IsISO8601({strict:true}) expiresAt?:string|null;
  @ValidateIf((_o,v)=>v!==undefined&&v!==null) @IsInt() @Min(1) @Max(1000000000) maxUses?:number|null;
  @ValidateIf((_o,v)=>v!==undefined&&v!==null) @IsInt() @Min(1) @Max(1000000000) perCustomerLimit?:number|null;
  @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() restoreOnCancellation?:boolean;
}
export class CreateCouponDto extends CouponOptionalDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{3,40}$/) code!:string;
  @IsIn(['PERCENTAGE','FIXED']) kind!:'PERCENTAGE'|'FIXED';
  @IsString() @Matches(/^\d{1,19}$/) value!:string;
}
export class UpdateCouponDto extends CouponOptionalDto {
  @IsInt() @Min(0) expectedVersion!:number;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(['PERCENTAGE','FIXED']) kind?:'PERCENTAGE'|'FIXED';
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @Matches(/^\d{1,19}$/) value?:string;
}
export class CouponQueryDto {
  @ValidateIf((_o,v)=>v!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit?:number;
  @ValidateIf((_o,v)=>v!==undefined) @Type(()=>Number) @IsInt() @Min(0) @Max(10000) offset?:number;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(40) query?:string;
}
