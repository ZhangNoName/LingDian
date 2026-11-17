import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class StoreContextQueryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(191)
  storeId?: string;
}
