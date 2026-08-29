import { Controller, Get } from '@nestjs/common';
import { StoreContextResolver } from '../stores/store-context.resolver';

@Controller('health')
export class HealthController {
  constructor(private readonly stores: StoreContextResolver) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'LingDian API',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  getLiveness() {
    return this.getHealth();
  }

  @Get('ready')
  async getReadiness() {
    await this.stores.assertReady();
    return {
      status: 'ready',
      service: 'LingDian API',
      timestamp: new Date().toISOString(),
    };
  }
}
