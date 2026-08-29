import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AddressesModule } from '../addresses/addresses.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [AuthModule, AddressesModule, IntegrationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
