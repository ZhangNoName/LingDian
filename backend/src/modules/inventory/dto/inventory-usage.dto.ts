import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import type { InventoryUsageView } from '@lingdian/contracts';
export class InventoryUsageQueryDto {
  @IsIn(['RECIPES', 'PURCHASES', 'STOCKTAKES']) view: InventoryUsageView = 'RECIPES';
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
}
