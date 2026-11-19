import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { InventoryMaterialChangeKind } from '@lingdian/contracts';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class RenameInventoryMaterialDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsInt() @Min(0) @Max(2147483646) expectedVersion!: number;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(240) reason!: string;
}
export class InventoryMaterialChangesDto {
  @IsIn(['ALL', 'NAME', 'ARCHIVE', 'RESTORE']) kind: InventoryMaterialChangeKind | 'ALL' = 'ALL';
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}
