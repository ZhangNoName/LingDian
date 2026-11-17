import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class StocktakeQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
  @IsOptional() @IsIn(['DRAFT', 'POSTED', 'CANCELLED', 'ALL']) status?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) keyword?: string;
}
export class CreateStocktakeDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) requestId!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(240) note!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(191, { each: true })
  itemIds!: string[];
}
export class StocktakeVersionDto {
  @IsInt() @Min(0) @Max(2147483646) expectedVersion!: number;
}
export class StocktakeCountDto {
  @IsString() @MinLength(1) @MaxLength(191) lineId!: string;
  @ValidateIf((_object, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999)
  countedQuantity!: number | null;
}
export class SaveStocktakeDto extends StocktakeVersionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => StocktakeCountDto)
  lines!: StocktakeCountDto[];
}
