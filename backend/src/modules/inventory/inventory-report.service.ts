import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { InventoryPeriodReport, InventoryReportRow } from '@lingdian/contracts';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryReportQueryDto } from './dto/inventory.dto';
import { activityPeriod, MAX_REPORT_ITEMS } from './inventory-query';

type AggregateRow = { itemId: string } & Record<keyof Pick<InventoryReportRow, 'opening' | 'received' | 'issued' | 'lost' | 'countGain' | 'countLoss' | 'closing' | 'movementCount'>, bigint | Prisma.Decimal | number | null>;

@Injectable()
export class InventoryReportService {
  constructor(private readonly prisma: PrismaService, private readonly scope: MerchantStoreScope) {}

  async report(user: AuthenticatedUser, storeId: string, query: InventoryReportQueryDto): Promise<InventoryPeriodReport> {
    this.scope.assertIncludes(user, storeId);
    const { start, end } = activityPeriod(query, true) as { start: Date; end: Date };
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.inventoryItem.findMany({
        where: { storeId, createdAt: { lt: end }, ...(query.itemId ? { id: query.itemId } : {}),
          ...(query.keyword ? { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] } : {}),
        }, select: { id: true, code: true, name: true, unit: true }, orderBy: [{ code: 'asc' }, { id: 'asc' }], take: MAX_REPORT_ITEMS + 1,
      });
      // Never return a partial report under a successful response.
      if (items.length > MAX_REPORT_ITEMS) throw new BadRequestException('inventory.reportTooLarge');
      const aggregates = items.length ? await tx.$queryRaw<AggregateRow[]>(Prisma.sql`
        SELECT itemId,
          SUM(CASE WHEN createdAt < ${start} THEN quantityAfter - quantityBefore ELSE 0 END) AS opening,
          SUM(CASE WHEN createdAt >= ${start} AND kind = 'RECEIVE' THEN amount ELSE 0 END) AS received,
          SUM(CASE WHEN createdAt >= ${start} AND kind = 'ISSUE' THEN amount ELSE 0 END) AS issued,
          SUM(CASE WHEN createdAt >= ${start} AND kind = 'LOSS' THEN amount ELSE 0 END) AS lost,
          SUM(CASE WHEN createdAt >= ${start} AND kind = 'COUNT' THEN GREATEST(quantityAfter - quantityBefore, 0) ELSE 0 END) AS countGain,
          SUM(CASE WHEN createdAt >= ${start} AND kind = 'COUNT' THEN GREATEST(quantityBefore - quantityAfter, 0) ELSE 0 END) AS countLoss,
          SUM(quantityAfter - quantityBefore) AS closing,
          SUM(CASE WHEN createdAt >= ${start} THEN 1 ELSE 0 END) AS movementCount
        FROM inventory_movements
        WHERE storeId = ${storeId} AND itemId IN (${Prisma.join(items.map((item) => item.id))}) AND createdAt < ${end}
        GROUP BY itemId
      `) : [];
      const byItem = new Map(aggregates.map((row) => [row.itemId, row]));
      return {
        storeId, startAt: start.toISOString(), endAt: end.toISOString(), generatedAt: new Date().toISOString(),
        rows: items.map((item) => {
          const row = byItem.get(item.id);
          return { itemId: item.id, code: item.code, name: item.name, unit: item.unit,
            opening: quantity(row?.opening), received: quantity(row?.received), issued: quantity(row?.issued), lost: quantity(row?.lost),
            countGain: quantity(row?.countGain), countLoss: quantity(row?.countLoss), closing: quantity(row?.closing), movementCount: integer(row?.movementCount),
          };
        }),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
  }
}

function integer(value: bigint | Prisma.Decimal | number | null | undefined): number {
  const result = Number(value ?? 0);
  if (!Number.isSafeInteger(result)) throw new BadRequestException('inventory.reportTooLarge');
  return result;
}
function quantity(value: bigint | Prisma.Decimal | number | null | undefined): number { return integer(value) / 1000; }
