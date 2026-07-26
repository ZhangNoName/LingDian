import type { AuthRole } from '@lingdian/contracts';
import { ArrayMinSize, IsArray, IsOptional, IsString, Length, MaxLength } from 'class-validator';
export class CreatePlatformUserDto {
  @IsOptional() @IsString() @MaxLength(32) nickname?: string;
  @IsString() @Length(3, 64) username!: string;
  @IsString() @Length(7, 32) phone!: string;
  @IsString() @Length(12, 256) password!: string;
  @IsArray() @ArrayMinSize(1) roles!: AuthRole[];
  @IsArray() @IsString({ each: true }) storeIds!: string[];
}
