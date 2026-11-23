import { StockHoldService } from './stock-hold.service';
import { StockHoldController } from './stock-hold.controller';
import { PaymentsModule } from '../payments/payments.module';
import { OrderStockExpiryService } from './order-stock-expiry.service';
import { InventoryModule } from '../inventory/inventory.module';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersQueryService } from './orders-query.service';
import { AddressesModule } from '../addresses/addresses.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MerchantModule } from '../merchant/merchant.module';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [PaymentsModule, InventoryModule, AuthModule, AddressesModule, IntegrationsModule, MerchantModule, StoresModule],
  controllers: [OrdersController, StockHoldController],
  providers: [StockHoldService, OrdersService, OrdersQueryService, OrderStockExpiryService],
})
export class OrdersModule {}
