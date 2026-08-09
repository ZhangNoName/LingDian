import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AddressesModule } from '../addresses/addresses.module';

@Module({
  imports: [AuthModule, AddressesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
