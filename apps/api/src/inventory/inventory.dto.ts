import {Type} from 'class-transformer';
import {IsString,Matches,IsArray,ArrayMinSize,ArrayMaxSize,IsUUID,IsInt,Min,Max,ValidateNested,ValidateIf} from 'class-validator';
export class ReservationLineDto {@IsUUID() variantId!:string; @IsInt() @Min(1) @Max(1000000) quantity!:number;}
export class ReservationDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,100}$/) key!:string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>ReservationLineDto) lines!:ReservationLineDto[];
  @ValidateIf((_o,v)=>v!==undefined) @IsInt() @Min(60) @Max(1800) ttlSeconds?:number;
}
