import {IsInt,Min,Max,IsString,Matches} from 'class-validator';
export class CartVersionDto {@IsInt() @Min(0) expectedVersion!:number;}
export class CartItemDto extends CartVersionDto {@IsInt() @Min(1) @Max(999) quantity!:number;}
export class CartMergeDto extends CartVersionDto {@IsInt() @Min(0) guestVersion!:number;}

export class CartCouponDto extends CartVersionDto {@IsString() @Matches(/^[A-Za-z0-9_-]{3,40}$/) code!:string;}
