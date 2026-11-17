import { PurchasingAnalysisService } from './purchasing/purchasing-analysis.service';
import { PurchasingController } from './purchasing/purchasing.controller';
import { PurchasingService } from './purchasing/purchasing.service';
import { SupplierService } from './purchasing/supplier.service';
import { InventoryAlertService } from './inventory-alert.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantModule } from '../merchant/merchant.module';
import { InventoryController } from './inventory.controller';
import { InventoryRecipeService } from './inventory-recipe.service';
import { OrderStockService } from './order-stock.service';
import { InventoryReportService } from './inventory-report.service';
import { InventoryService } from './inventory.service';
import { StocktakeController } from './stocktakes/stocktake.controller';
import { StocktakeService } from './stocktakes/stocktake.service';

@Module({
  imports: [AuthModule, MerchantModule],
  controllers: [InventoryController, PurchasingController, StocktakeController],
  providers: [StocktakeService, PurchasingAnalysisService, PurchasingService, SupplierService, InventoryAlertService, InventoryService, InventoryReportService, InventoryRecipeService, OrderStockService],
  exports: [OrderStockService],
})
export class InventoryModule {}
