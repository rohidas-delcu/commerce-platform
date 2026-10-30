import { Type } from "class-transformer";
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString,
  Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested
} from "class-validator";

export class CreateStoreDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsString() @MinLength(1) @MaxLength(63) handle!: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/^[a-zA-Z]{2}$/) countryCode?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsString() @Matches(/^[a-zA-Z]{3}$/) currencyCode?: string;
}

export class VariantDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsString() @MinLength(2) @MaxLength(80) sku!: string;
  @IsInt() @Min(0) @Max(2_000_000_000) stock!: number;
}

export class CreateProductDto {
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
