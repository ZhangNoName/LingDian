import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { MerchantStoreScope } from './merchant-store-scope';

@Module({
  imports: [AuthModule],
  controllers: [MerchantController],
  providers: [MerchantService, MerchantStoreScope],
})
export class MerchantModule {}
