import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { SystemLogLevel, SystemLogSource } from '@lingdian/contracts';

export class ClientLogEventDto {
  @IsIn(['MINIAPP', 'MERCHANT_WEB', 'ADMIN_WEB'])
  source!: Exclude<SystemLogSource, 'SERVER'>;

  @IsIn(['WARN', 'ERROR'])
  level!: Extract<SystemLogLevel, 'WARN' | 'ERROR'>;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  event!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  message!: string;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  details?: Record<string, unknown>;
}
