import type { AuthRole } from '@lingdian/contracts';
import { ArrayMinSize, IsArray, IsOptional, IsString, Length, MaxLength } from 'class-validator';
export class UpdatePlatformUserDto {
  @IsOptional() @IsString() @MaxLength(32) nickname?: string;
  @IsOptional() @IsString() @Length(3, 64) username?: string;
  @IsOptional() @IsString() @Length(7, 32) phone?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) roles?: AuthRole[];
  @IsOptional() @IsArray() @IsString({ each: true }) storeIds?: string[];
}
