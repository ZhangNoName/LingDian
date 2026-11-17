import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { InventoryReportQueryDto, InventoryMaterialFilterDto } from '../dto/inventory.dto';
export class PurchaseReportQueryDto extends InventoryReportQueryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(191) supplierId?: string;
}
export class ReplenishmentQueryDto extends InventoryMaterialFilterDto {}
