import { Type } from "class-transformer";
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsBoolean, IsObject,
  Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested
} from "class-validator";

export class CreateStoreDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsString() @MinLength(1) @MaxLength(63) handle!: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/^[a-zA-Z]{2}$/) countryCode?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/^[a-zA-Z]{3}$/) currencyCode?: string;
}


export class VariantMetadataDto {
  @IsString() @MinLength(1) @MaxLength(100) name!:string;
  @IsString() @MinLength(2) @MaxLength(80) sku!:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() active?:boolean;
  @IsOptional() @IsString() @Matches(/^[0-9]{1,18}$/) priceMinor?:string|null;
  @IsOptional() @IsString() @Matches(/^[0-9]{1,18}$/) compareMinor?:string|null;
  @ValidateIf((_o,v)=>v!==undefined) @IsObject() options?:Record<string,string>;
}
export class VariantDto extends VariantMetadataDto {
  @IsInt() @Min(0) @Max(2_000_000_000) stock!:number;
}
export class UpdateVariantDto {
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MinLength(1) @MaxLength(100) name?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MinLength(2) @MaxLength(80) sku?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() active?:boolean;
  @IsOptional() @IsString() @Matches(/^[0-9]{1,18}$/) priceMinor?:string|null;
  @IsOptional() @IsString() @Matches(/^[0-9]{1,18}$/) compareMinor?:string|null;
  @ValidateIf((_o,v)=>v!==undefined) @IsObject() options?:Record<string,string>;
}

export class CreateProductDto {
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(70) seoTitle?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(320) seoDescription?:string;
  @IsString() @MinLength(1) @MaxLength(150) name!: string;
  @IsString() @MinLength(1) @MaxLength(63) handle!: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(20000) description?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(150) collection?: string;
  @IsString() @Matches(/^[0-9]{1,18}$/) priceMinor!: string;
  @IsOptional() @IsString() @Matches(/^[0-9]{1,18}$/) compareMinor?: string | null;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => VariantDto)
  variants!: VariantDto[];
}

export class UpdateProductDto {
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(70) seoTitle?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(320) seoDescription?:string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MinLength(1) @MaxLength(150) name?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MinLength(1) @MaxLength(63) handle?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(20000) description?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(150) collection?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/^[0-9]{1,18}$/) priceMinor?: string;
  @IsOptional() @IsString() @Matches(/^[0-9]{1,18}$/) compareMinor?: string | null;
}

export class StockAdjustmentDto {
  @IsInt() @Min(0) @Max(2_000_000_000) quantity!: number;
  @IsIn(["STOCK_COUNT", "RECEIVED", "DAMAGED", "RETURNED", "OTHER"]) reason!: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(500) note?: string;
}


export class PublicProductQueryDto {
  @IsOptional() @IsString() @MaxLength(100) query?:string;
  @IsOptional() @IsString() @MaxLength(150) collection?:string;
  @IsOptional() @IsIn(['created','name','price_asc','price_desc']) sort?:'created'|'name'|'price_asc'|'price_desc';
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit?:number;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(0) @Max(10000) offset?:number;
}
export class ProductQueryDto extends PublicProductQueryDto {
  @IsOptional() @IsIn(['DRAFT','ACTIVE','ARCHIVED']) status?:'DRAFT'|'ACTIVE'|'ARCHIVED';
}


export class CreateCollectionDto {
  @IsString() @MinLength(1) @MaxLength(150) name!:string;
  @IsString() @MinLength(1) @MaxLength(63) handle!:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(20000) description?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() featured?:boolean;
  @ValidateIf((_o,v)=>v!==undefined) @IsInt() @Min(0) @Max(1000000) position?:number;
}
export class UpdateCollectionDto {
  @IsInt() @Min(0) expectedVersion!:number;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MinLength(1) @MaxLength(150) name?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MinLength(1) @MaxLength(63) handle?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsString() @MaxLength(20000) description?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() featured?:boolean;
  @ValidateIf((_o,v)=>v!==undefined) @IsInt() @Min(0) @Max(1000000) position?:number;
}
export class CollectionVersionDto {@IsInt() @Min(0) expectedVersion!:number;}
export class CollectionLinkDto extends CollectionVersionDto {@IsInt() @Min(0) @Max(1000000) position!:number;}
export class PublicCollectionQueryDto {
  @IsOptional() @IsString() @MaxLength(100) query?:string;
  @IsOptional() @IsIn(['true','false']) featured?:'true'|'false';
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit?:number;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(0) @Max(10000) offset?:number;
}
export class CollectionQueryDto extends PublicCollectionQueryDto {@IsOptional() @IsIn(['ACTIVE','ARCHIVED']) status?:'ACTIVE'|'ARCHIVED';}
