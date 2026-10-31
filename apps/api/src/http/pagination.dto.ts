import {Type} from 'class-transformer';
import {IsInt,Min,Max,ValidateIf} from 'class-validator';
export class PageDto {
  @ValidateIf((_o,v)=>v!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit?:number;
  @ValidateIf((_o,v)=>v!==undefined) @Type(()=>Number) @IsInt() @Min(0) @Max(10000) offset?:number;
}
