import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class RecipeQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(120) keyword?: string;
}
class RecipeEntryDto {
  @IsString() @MinLength(1) @MaxLength(191) itemId!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(999999) quantity!: number;
}
export class SaveRecipeDto {
  @IsInt() @Min(0) @Max(2147483646) expectedVersion!: number;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => RecipeEntryDto) entries!: RecipeEntryDto[];
}
