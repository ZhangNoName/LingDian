import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductImageStorage } from './product-image-storage';
@Injectable()
export class ProductImageCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductImageCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    private readonly db: PrismaService,
    private readonly storage: ProductImageStorage,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.run();
    }, 3600000);
    this.timer.unref();
    void this.run();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.cleanupExpired();
    } catch {
      this.logger.warn('Product image cleanup will retry on the next cycle');
    } finally {
      this.running = false;
    }
  }
  async cleanupExpired(cutoff = new Date(Date.now() - 86400000)) {
    const requests = await this.db.productImageRequest.findMany({
      where: { OR: [{ state: 'FAILED' }, { state: 'PENDING', createdAt: { lt: cutoff } }] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    let cleaned = 0;
    for (const row of requests) {
      if (row.state === 'PENDING')
        await this.db.productImageRequest.updateMany({
          where: { id: row.id, state: 'PENDING', createdAt: { lt: cutoff } },
          data: { state: 'FAILED' },
        });
      const current = await this.db.productImageRequest.findUnique({ where: { id: row.id } });
      if (current?.state !== 'FAILED') continue;
      if (row.imageUrl && (await this.db.product.count({ where: { imageUrl: row.imageUrl } }))) {
        await this.db.productImageRequest.updateMany({
          where: { id: row.id, state: 'FAILED' },
          data: { state: 'RETAINED' },
        });
        continue;
      }
      if (row.assetKey) await this.storage.remove(row.storeId, row.assetKey);
      const changed = await this.db.productImageRequest.updateMany({
        where: { id: row.id, state: 'FAILED' },
        data: { state: 'CLEANED' },
      });
      cleaned += changed.count;
    }
    return cleaned;
  }
}
