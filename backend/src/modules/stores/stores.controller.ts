import { Controller, Get } from '@nestjs/common';

@Controller('stores')
export class StoresController {
  @Get('current')
  getCurrentStore() {
    return {
      id: 'store-demo-001',
      name: '零点示范店',
      status: 'open',
      businessHours: '09:00-22:00',
      dineInEnabled: true,
      takeoutEnabled: true,
      pickupEnabled: true,
      theme: {
        primaryColor: '#ff6b35',
        coverImage: '/assets/store-cover.png',
      },
    };
  }
}
