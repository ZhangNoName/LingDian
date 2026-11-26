import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantModule } from '../merchant/merchant.module';
import { StoresModule } from '../stores/stores.module';
import { MobileInboxController } from './mobile-inbox.controller';
import { MobileInboxService } from './mobile-inbox.service';

@Module({
  imports: [AuthModule, MerchantModule, StoresModule],
  controllers: [MobileInboxController],
  providers: [MobileInboxService],
})
export class MobileInboxModule {}
