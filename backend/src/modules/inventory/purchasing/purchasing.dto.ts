import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { PurchaseDeliveryFilter } from '@lingdian/contracts';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class PurchasingQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) keyword?: string;
  @IsOptional() @IsIn(['ACTIVE', 'OPEN', 'PARTIAL', 'RECEIVED', 'CANCELLED', 'ALL']) status?: string;
}
export class PurchaseOrderQueryDto extends PurchasingQueryDto {
  @IsOptional() @IsIn(['ALL', 'BEFORE', 'UNDATED']) delivery?: PurchaseDeliveryFilter;
  @IsOptional() @IsISO8601({ strict: true, strictSeparator: true }) @Matches(/(?:Z|[+-]\d{2}:\d{2})$/) expectedBefore?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(191) pendingItemId?: string;
}
export class SupplierDto {
  @Transform(trim) @IsString() @Matches(/^[A-Za-z0-9_-]{1,64}$/) code!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @Transform(trim) @IsString() @MaxLength(191) contact = '';
  @Transform(trim) @IsString() @MaxLength(240) note = '';
  @IsBoolean() isActive = true;
}
export class UpdateSupplierDto extends SupplierDto {
  @IsInt() @Min(0) @Max(2147483646) expectedVersion!: number;
}
export class PurchaseLineDto {
  @IsString() @MinLength(1) @MaxLength(191) itemId!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(999999) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999999.99) unitPrice!: number;
}
export class CreatePurchaseDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) requestId!: string;
  @IsString() @MinLength(1) @MaxLength(191) supplierId!: string;
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  expectedAt?: string;
  @Transform(trim) @IsString() @MaxLength(240) note = '';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[];
}
export class ReceiveLineDto {
  @IsString() @MinLength(1) @MaxLength(191) lineId!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(999999) quantity!: number;
}
export class CancelPurchaseDto {
  @IsInt() @Min(0) @Max(2147483646) expectedVersion!: number;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(240) note!: string;
}
export class ReceivePurchaseDto extends CancelPurchaseDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) requestId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
}
