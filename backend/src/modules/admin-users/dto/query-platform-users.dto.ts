import type { AuthRole, PlatformAccountType, PlatformUserStatus } from '@lingdian/contracts';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryPlatformUsersDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsIn(['ADMINISTRATOR', 'MERCHANT', 'USER']) accountType?: PlatformAccountType;
  @IsOptional() @IsIn(['USER', 'MERCHANT', 'ADMIN', 'SUPER_ADMIN']) role?: AuthRole;
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: PlatformUserStatus;
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
