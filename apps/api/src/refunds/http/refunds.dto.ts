import {Type} from 'class-transformer';
import {IsInt,Min,Max,IsOptional,IsString,Matches,MaxLength,MinLength,IsIn} from 'class-validator';
export class ManualRefundDto {
 @IsInt() @Min(0) expectedVersion!:number;
 @IsString() @Matches(/^[A-Za-z0-9_-]{8,100}$/) key!:string;
 @IsString() @Matches(/^\d{1,19}$/) amountMinor!:string;
 @IsString() @MinLength(1) @MaxLength(150) reference!:string;
 @IsIn(['CASH_RETURNED']) confirmation!:'CASH_RETURNED';
}

export class RefundQueryDto {
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit?:number;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(0) @Max(10000) offset?:number;
}
