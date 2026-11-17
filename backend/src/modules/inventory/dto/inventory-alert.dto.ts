import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { InventoryAlertStatus } from '@lingdian/contracts';
export class InventoryAlertQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;
  @IsOptional() @IsIn(['ACTIVE', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'])
  status: InventoryAlertStatus | 'ACTIVE' | 'ALL' = 'ACTIVE';
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(120)
  keyword?: string;
  @IsOptional() @IsIn(['LOW', 'OUT'])
  severity?: 'LOW' | 'OUT';
}
export class AcknowledgeInventoryAlertDto {
  @IsInt() @Min(0) @Max(2147483646)
  expectedVersion!: number;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(240)
  note!: string;
}
