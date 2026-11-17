import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { InventoryMovementKind, InventoryStatus } from '@lingdian/contracts';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class InventoryQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  page = 1;

  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  keyword?: string;

  @IsOptional() @IsIn(['HEALTHY', 'LOW', 'OUT'])
  status?: InventoryStatus;
}

export class InventoryHistoryQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  page = 1;

  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @IsOptional() @IsString() @MaxLength(191)
  itemId?: string;
}

export class CreateInventoryItemDto {
  @Transform(trim) @IsString() @Matches(/^[A-Za-z0-9_-]{1,64}$/)
  code!: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(16)
  unit!: string;

  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(999999)
  reorderPoint!: number;
}

export class AdjustInventoryDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  requestId!: string;

  @IsIn(['RECEIVE', 'ISSUE', 'COUNT', 'THRESHOLD'])
  kind!: InventoryMovementKind;

  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(999999)
  amount!: number;

  @IsInt() @Min(0) @Max(2147483646)
  expectedVersion!: number;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(240)
  reason!: string;
}
