import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, Max, Min } from 'class-validator';

export class UpdateSkuStockDto {
  @ApiProperty({
    description: 'SKU ID',
    example: 'cmofp2e9y0003w0j6jezkngva',
  })
  @IsNotEmpty()
  sku_id!: string | number;

  @ApiProperty({
    description: '最新库存数量',
    example: 120,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @Max(999999)
  stock_count!: number;
  @IsOptional() @IsInt() @Min(0) @Max(2147483646)
  expected_version?: number;

}
