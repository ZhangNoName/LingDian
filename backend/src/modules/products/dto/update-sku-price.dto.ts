import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

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
  @IsNumber()
  @Min(0)
  price!: number;
}
