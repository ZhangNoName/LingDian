import { Controller, Get, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('current')
  async getCurrentStore() {
    const store = await this.prisma.store.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!store) throw new NotFoundException('Store not found');
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
