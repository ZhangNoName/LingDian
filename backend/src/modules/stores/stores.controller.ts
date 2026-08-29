import { Controller, Get } from '@nestjs/common';
import { StoreContextResolver } from './store-context.resolver';

@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoreContextResolver) {}

  @Get('current')
  async getCurrentStore() {
    const store = await this.stores.resolveCurrentStore();
    return {
      id: store.id,
      name: store.name,
      status: store.status.toLowerCase(),
      businessHours: store.businessHours,
      dineInEnabled: store.dineInEnabled,
      takeoutEnabled: store.takeoutEnabled,
      pickupEnabled: store.pickupEnabled,
      theme: {
        primaryColor: '#ff6b35',
        coverImage: '/assets/store-cover.png',
      },
    };
  }
}
