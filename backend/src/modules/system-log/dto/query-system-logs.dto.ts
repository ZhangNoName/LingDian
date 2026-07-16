import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { SystemLogLevel, SystemLogSource } from '@lingdian/contracts';

export class QuerySystemLogsDto {
  @IsOptional()
  @IsIn(['SERVER', 'MINIAPP', 'MERCHANT_WEB', 'ADMIN_WEB'])
  source?: SystemLogSource;

  @IsOptional()
  @IsIn(['INFO', 'WARN', 'ERROR', 'FATAL'])
  level?: SystemLogLevel;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
