import {Type} from 'class-transformer';
import {IsInt,Min,Max,ValidateIf,IsIn,IsString,MaxLength} from 'class-validator';
import type {OrderStatus} from '../domain/orders.js';
export class OrderQueryDto {
  @ValidateIf((_o,v)=>v!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit?:number;
  @ValidateIf((_o,v)=>v!==undefined) @Type(()=>Number) @IsInt() @Min(0) @Max(10000) offset?:number;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(['PLACED','COMPLETED','CANCELLED']) status?:OrderStatus;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) query?:string;
}
export class PlaceCodDto {@IsInt() @Min(0) expectedVersion!:number; @IsIn(['COD']) paymentMethod!:'COD';}
