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
  imports: [AuthModule, AddressesModule, IntegrationsModule, MerchantModule, StoresModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersQueryService],
})
export class OrdersModule {}
