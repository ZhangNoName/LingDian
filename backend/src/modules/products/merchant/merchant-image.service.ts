import { ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@lingdian/db';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { PrismaService } from '../../../prisma/prisma.service';
import { MerchantStoreScope } from '../../merchant/merchant-store-scope';
import { ProductsService } from '../products.service';
import { claimCatalogVersion } from '../product-write-policy';
import { MerchantImageDto } from './merchant-image.dto';
import { ProductImageStorage, imageAssetUrl, type MerchantImageFile } from './product-image-storage';
type ImageRequest = Prisma.ProductImageRequestGetPayload<Prisma.ProductImageRequestDefaultArgs>;
@Injectable()
export class MerchantImageService {
  private readonly logger = new Logger(MerchantImageService.name);
  constructor(
    private readonly db: PrismaService,
    private readonly scope: MerchantStoreScope,
    private readonly products: ProductsService,
    private readonly storage: ProductImageStorage,
  ) {}
  upload(user: AuthenticatedUser, storeId: string, id: string, body: MerchantImageDto, file?: MerchantImageFile) {
    return this.change(user, storeId, id, body, 'UPLOAD', file);
  }
  remove(user: AuthenticatedUser, storeId: string, id: string, body: MerchantImageDto) {
    return this.change(user, storeId, id, body, 'REMOVE');
  }
  private replay(row: ImageRequest, fingerprint: string) {
    if (row.fingerprint !== fingerprint) throw new ConflictException('catalog.imageRequestConflict');
    if (!['PENDING', 'APPLIED'].includes(row.state)) throw new ConflictException('catalog.imageRequestClosed');
  }
  private async fail(row: ImageRequest) {
    const failed = await this.db.productImageRequest.updateMany({
      where: { id: row.id, state: 'PENDING' },
      data: { state: 'FAILED' },
    });
    const current = failed.count
      ? { state: 'FAILED' }
      : await this.db.productImageRequest.findUnique({ where: { id: row.id } });
    if (['FAILED', 'CLEANED'].includes(current?.state ?? '') && row.assetKey)
      await this.storage
        .remove(row.storeId, row.assetKey)
        .catch(() => this.logger.warn('A failed image attempt awaits file cleanup'));
  }
  private async change(
    user: AuthenticatedUser,
    storeId: string,
    id: string,
    body: MerchantImageDto,
    operation: 'UPLOAD' | 'REMOVE',
    file?: MerchantImageFile,
  ) {
    this.scope.assertIncludes(user, storeId);
    const product = await this.db.product.findFirst({
      where: { id, storeId },
      select: { id: true, configurationVersion: true },
    });
    if (!product) throw new NotFoundException('catalog.productUnavailable');
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          actor: user.userId,
          product: id,
          operation,
          version: body.expected_version,
          mime: file?.mimetype ?? '',
          bytes: file ? createHash('sha256').update(file.buffer).digest('hex') : '',
        }),
      )
      .digest('hex');
    const where = { storeId_requestId: { storeId, requestId: body.requestId } };
    let row = await this.db.productImageRequest.findUnique({ where });
    if (row) {
      this.replay(row, fingerprint);
      if (row.state === 'PENDING' && row.createdAt.getTime() < Date.now() - 86400000) {
        await this.fail(row);
        throw new ConflictException('catalog.imageRequestClosed');
      }
      if (row.state === 'APPLIED') return this.products.getProductDetail(id, [storeId]);
    }
    if (product.configurationVersion !== body.expected_version) {
      if (row) await this.fail(row);
      throw new ConflictException('catalog.stale');
    }
    const bytes = operation === 'UPLOAD' ? await this.storage.normalize(file) : undefined;
    if (!row) {
      const assetKey = operation === 'UPLOAD' ? randomUUID() : null;
      try {
        row = await this.db.productImageRequest.create({
          data: {
            storeId,
            productId: id,
            requestId: body.requestId,
            fingerprint,
            operation,
            expectedVersion: body.expected_version,
            assetKey,
            imageUrl: assetKey ? imageAssetUrl(storeId, assetKey) : null,
            createdBy: user.userId,
          },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        row = await this.db.productImageRequest.findUniqueOrThrow({ where });
        this.replay(row, fingerprint);
      }
    }
    if (row.state === 'APPLIED') return this.products.getProductDetail(id, [storeId]);
    if (row.assetKey && bytes) {
      try {
        await this.storage.write(storeId, row.assetKey, bytes);
      } catch {
        await this.fail(row).catch(() => this.logger.warn('An image storage failure awaits retry cleanup'));
        throw new ServiceUnavailableException('catalog.imageStorageFailed');
      }
    }
    const request = row;
    try {
      await this.db.$transaction(
        async (tx) => {
          const claimed = await tx.productImageRequest.updateMany({
            where: { id: request.id, state: 'PENDING' },
            data: { state: 'APPLYING' },
          });
          if (claimed.count !== 1) {
            const current = await tx.productImageRequest.findUniqueOrThrow({ where: { id: request.id } });
            this.replay(current, fingerprint);
            if (current.state === 'APPLIED') return;
            throw new ConflictException('catalog.imageRequestClosed');
          }
          await claimCatalogVersion(tx, id, storeId, body.expected_version);
          const before = await tx.product.findUniqueOrThrow({ where: { id } });
          await tx.product.update({ where: { id }, data: { imageUrl: request.imageUrl } });
          await tx.authAuditLog.create({
            data: {
              event: operation === 'UPLOAD' ? 'CATALOG_PRODUCT_IMAGE_UPDATED' : 'CATALOG_PRODUCT_IMAGE_REMOVED',
              userId: user.userId,
              sessionId: user.sessionId,
              metadata: {
                storeId,
                productId: id,
                requestId: body.requestId,
                expectedVersion: body.expected_version,
                before: before.imageUrl,
                after: request.imageUrl,
              },
            },
          });
          await tx.productImageRequest.update({ where: { id: request.id }, data: { state: 'APPLIED' } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 },
      );
    } catch (error) {
      const committed = await this.db.productImageRequest.findUnique({ where }).catch(() => null);
      if (committed?.state === 'APPLIED' && committed.fingerprint === fingerprint)
        return this.products.getProductDetail(id, [storeId]);
      if (error instanceof ConflictException)
        await this.fail(request).catch(() => this.logger.warn('An image version conflict awaits file cleanup'));
      throw error;
    }
    return this.products.getProductDetail(id, [storeId]);
  }
}
