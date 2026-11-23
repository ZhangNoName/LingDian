import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
export type CatalogActor = { userId: string; sessionId?: string };
export function requireCatalogVersion(value: number | undefined): number {
  if (!Number.isInteger(value) || value! < 0) throw new BadRequestException('catalog.versionRequired');
  return value!;
}
/** Catalog writers serialize on product, before touching variants. Legacy admin writes also invalidate drafts. */
export async function claimCatalogVersion(
  tx: Prisma.TransactionClient,
  productId: string,
  storeId: string,
  expectedVersion?: number,
) {
  if (expectedVersion !== undefined) requireCatalogVersion(expectedVersion);
  const changed = await tx.product.updateMany({
    where: {
      id: productId,
      storeId,
      ...(expectedVersion !== undefined ? { configurationVersion: expectedVersion } : {}),
    },
    data: { configurationVersion: { increment: 1 } },
  });
  if (changed.count !== 1) throw new ConflictException('catalog.stale');
}
