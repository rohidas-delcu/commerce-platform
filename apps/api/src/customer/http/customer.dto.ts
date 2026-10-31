import {IsString,MaxLength,MinLength,IsIn,IsBoolean,ValidateIf,IsInt,Min,Matches} from 'class-validator';
export class AddressDto {
  @IsString() @MinLength(1) @MaxLength(100) name!:string;
  @IsString() @MinLength(1) @MaxLength(200) line1!:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(200) line2?:string;
  @IsString() @MinLength(1) @MaxLength(100) city!:string;
  @IsString() @MinLength(1) @MaxLength(100) region!:string;
  @IsString() @MinLength(1) @MaxLength(100) postalCode!:string;
  @IsIn(['IN','US','GB','CA','AU']) countryCode!:string;
  @IsString() @Matches(/^\+?[0-9 ()-]{7,30}$/) phone!:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() isDefault?:boolean;
}
export class UpdateAddressDto extends AddressDto {@IsInt() @Min(0) expectedVersion!:number;}
export class AddressVersionDto {@IsInt() @Min(0) expectedVersion!:number;}

export {PageDto as CustomerPageDto} from '../../http/pagination.dto.js';
