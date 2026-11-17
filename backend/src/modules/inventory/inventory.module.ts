import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantModule } from '../merchant/merchant.module';
import { InventoryController } from './inventory.controller';
import { InventoryRecipeService } from './inventory-recipe.service';
import { OrderStockService } from './order-stock.service';
import { InventoryReportService } from './inventory-report.service';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuthModule, MerchantModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryReportService, InventoryRecipeService, OrderStockService],
  exports: [OrderStockService],
})
export class InventoryModule {}
