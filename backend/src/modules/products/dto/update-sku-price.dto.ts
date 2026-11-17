import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateSkuPriceDto {
  @ApiProperty({
    description: 'SKU ID',
    example: 'cmofp2e9y0003w0j6jezkngva',
  })
  @IsNotEmpty()
  sku_id!: string | number;

  @ApiProperty({
    description: '最新售价',
    example: 19.9,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Max(99999999.99)
  @Min(0)
  price!: number;
  @IsOptional() @IsInt() @Min(0) @Max(2147483646)
  expected_version?: number;

}
