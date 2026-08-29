import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module';
import { HealthController } from './health.controller';

@Module({
  imports: [StoresModule],
  controllers: [HealthController],
})
export class HealthModule {}
