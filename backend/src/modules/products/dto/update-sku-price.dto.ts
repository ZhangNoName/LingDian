import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class UpdateSkuPriceDto {
  @IsNotEmpty()
  sku_id!: string | number;

  @IsNumber()
  @Min(0)
  price!: number;
}
