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
export class OrderCommandDto {@IsInt() @Min(0) expectedVersion!:number; @IsString() @MaxLength(100) key!:string;}
export class DispatchDto extends OrderCommandDto {
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) carrier?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(100) reference?:string;
}
export class CollectCodDto extends OrderCommandDto {@IsString() @MaxLength(19) amountMinor!:string;}
export class CancelOrderDto extends OrderCommandDto {@IsString() @MaxLength(500) reason!:string;}

export class OrderNoteDto extends OrderCommandDto {@IsString() @MaxLength(2000) note!:string;}
