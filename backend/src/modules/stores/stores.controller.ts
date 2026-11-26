import type { PublicMenuStore } from '@lingdian/contracts';
import { Prisma } from '@lingdian/db';
import { StoreContextQueryDto } from './dto/store-context.dto';
import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicStoreListDto } from './dto/public-store-list.dto';
import { StoreContextResolver } from './store-context.resolver';

@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoreContextResolver, private readonly prisma: PrismaService) {}

  @Get()
  async listPublicStores(@Query() { keyword, page, pageSize }: PublicStoreListDto) {
    const primaryId = this.stores.primaryStoreId();
    const selectable = this.stores.mode === 'single' ? Prisma.sql`s.id = ${primaryId}` : Prisma.sql`(
      s.id = ${primaryId} OR EXISTS (
        SELECT 1 FROM products p
        JOIN categories c ON c.id = p.categoryId AND c.storeId = p.storeId AND c.isVisible = true
        JOIN product_skus sku ON sku.productId = p.id AND sku.isActive = true
        WHERE p.storeId = s.id AND p.status = 'ACTIVE'
      )
    )`;
    const search = keyword ? Prisma.sql`AND LOCATE(${keyword}, s.name) > 0` : Prisma.empty;
    const where = Prisma.sql`FROM stores s WHERE ${selectable} ${search}`;
    const [rows, [count]] = await this.prisma.$transaction([
      this.prisma.$queryRaw<PublicMenuStore[]>(Prisma.sql`
        SELECT s.id, s.name, LOWER(s.status) AS status, s.businessHours
        ${where} ORDER BY (s.id = ${primaryId}) DESC, s.name ASC, s.id ASC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `),
      this.prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${where}`),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items: rows, total: Number(count.total), page, pageSize };
  }

  @Get('current')
  async getCurrentStore(@Query() query: StoreContextQueryDto = {}) {
    const store = await this.stores.resolveCurrentStore(undefined, query.storeId);
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
