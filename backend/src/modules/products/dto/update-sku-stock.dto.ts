import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class UpdateSkuStockDto {
  @IsNotEmpty()
  sku_id!: string | number;

  @IsInt()
  @Min(0)
  stock_count!: number;
}
