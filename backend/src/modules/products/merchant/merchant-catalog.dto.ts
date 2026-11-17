import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { ProductStatus } from '@lingdian/contracts';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class MerchantCategoryQueryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(191) categoryId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 50;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) keyword?: string;
}
export class MerchantCategoryDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) name!: string;
}
export class MerchantProductDetailsDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(191) category_id!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(191) name!: string;
  @Transform(trim) @IsString() @MaxLength(2000) description = '';
  @IsBoolean() is_featured = false;
}
export class CreateMerchantProductDto extends MerchantProductDetailsDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) requestId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99999999.99) price!: number;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(191) sku_name!: string;
}
export class UpdateMerchantProductDto extends MerchantProductDetailsDto {
  @IsInt() @Min(0) @Max(2147483646) expected_version!: number;
}
export class MerchantProductStatusDto {
  @IsInt() @Min(0) @Max(2147483646) expected_version!: number;
  @IsIn(['DRAFT', 'ACTIVE', 'SOLD_OUT', 'ARCHIVED']) status!: ProductStatus;
}

export class UpdateMerchantCategoryDto extends MerchantCategoryDto {
  @IsInt() @Min(0) @Max(2147483646) expected_version!: number;
  @IsInt() @Min(0) @Max(1000000) sort_order!: number;
  @IsBoolean() is_visible!: boolean;
}
