import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class StockHoldPageDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;
}
export class StockHoldQueryDto extends StockHoldPageDto {
  @IsOptional() @IsIn(['EXPIRED', 'ALL'])
  state: 'EXPIRED' | 'ALL' = 'EXPIRED';
  @IsOptional() @IsString() @MaxLength(64)
  keyword?: string;
}
