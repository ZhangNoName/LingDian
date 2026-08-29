import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { MerchantStoreScope } from './merchant-store-scope';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [MerchantController],
  providers: [MerchantService, MerchantStoreScope],
  exports: [MerchantService, MerchantStoreScope],
})
export class MerchantModule {}
