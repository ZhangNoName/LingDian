import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantModule } from '../merchant/merchant.module';
import { PaymentGatewayFactory } from './payment.gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [AuthModule, MerchantModule, StoresModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentGatewayFactory],
  exports: [PaymentsService],
})
export class PaymentsModule {}
