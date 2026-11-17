import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantModule } from '../merchant/merchant.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuthModule, MerchantModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
