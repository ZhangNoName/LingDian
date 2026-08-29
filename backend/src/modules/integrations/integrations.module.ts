import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantModule } from '../merchant/merchant.module';
import { IntegrationCatalogService } from './integration-catalog.service';
import { IntegrationOutboxService } from './integration-outbox.service';
import { IntegrationsController } from './integrations.controller';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [AuthModule, MerchantModule, StoresModule],
  controllers: [IntegrationsController],
  providers: [IntegrationCatalogService, IntegrationOutboxService],
  exports: [IntegrationCatalogService, IntegrationOutboxService],
})
export class IntegrationsModule {}
