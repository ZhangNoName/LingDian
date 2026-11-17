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

@Module({
  imports: [AuthModule, MerchantModule],
  controllers: [InventoryController, PurchasingController],
  providers: [PurchasingService, SupplierService, InventoryAlertService, InventoryService, InventoryReportService, InventoryRecipeService, OrderStockService],
  exports: [OrderStockService],
})
export class InventoryModule {}
