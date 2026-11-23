import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class InventoryTrendDto {
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startAt?: string;
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endAt?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) fromDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) toDate?: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  timeZone!: string;
}
