import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { InventoryDailyTrend, InventoryTrendDay } from '@lingdian/contracts';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { MerchantStoreScope } from '../../merchant/merchant-store-scope';
import { PrismaService } from '../../../prisma/prisma.service';
import { presentItem } from '../inventory-presenter';
import { InventoryTrendDto } from './inventory-trend.dto';
import { trendDays, trendPeriod } from './days';
type Numeric = bigint | Prisma.Decimal | number | null;
type Aggregate = {
  bucket: Numeric;
  quantityDelta: Numeric;
  reservedDelta: Numeric;
  received: Numeric;
  issued: Numeric;
  lost: Numeric;
  countGain: Numeric;
  countLoss: Numeric;
  movementCount: Numeric;
};
const flows = ['received', 'issued', 'lost', 'countGain', 'countLoss', 'movementCount'] as const;
function integer(value: Numeric | undefined) {
  const result = Number(value ?? 0);
  if (!Number.isSafeInteger(result)) throw new BadRequestException('inventory.trendOverflow');
  return result;
}
function balance(quantity: number, reserved: number) {
  if (quantity < 0 || reserved < 0 || reserved > quantity)
    throw new BadRequestException('inventory.trendUnavailable');
}
@Injectable()
export class InventoryTrendService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: MerchantStoreScope,
  ) {}
  async report(
    user: AuthenticatedUser,
    storeId: string,
    itemId: string,
    query: InventoryTrendDto,
  ): Promise<InventoryDailyTrend> {
    this.scope.assertIncludes(user, storeId);
    const period = trendPeriod(query),
      boundaries = trendDays(period.start, period.end, period.timeZone);
    return this.db.$transaction(
      async (tx) => {
        const item = await tx.inventoryItem.findUnique({ where: { id_storeId: { id: itemId, storeId } } });
        if (!item) throw new NotFoundException('inventory.notFound');
        const asOf = new Date();
        const active = boundaries
          .map((day, bucket) => ({
            ...day,
            bucket,
            effectiveStart: new Date(Math.max(day.start.getTime(), item.createdAt.getTime())),
            effectiveEnd: new Date(Math.min(day.end.getTime(), asOf.getTime())),
          }))
          .filter((day) => day.effectiveEnd > day.effectiveStart);
        const openingCut = active[0]?.effectiveStart;
        const beforeRows = openingCut
          ? await tx.$queryRaw<Aggregate[]>(Prisma.sql`
        SELECT SUM(quantityAfter - quantityBefore) AS quantityDelta, SUM(reservedAfter - reservedBefore) AS reservedDelta, COUNT(*) AS movementCount
        FROM inventory_movements FORCE INDEX (inventory_movements_storeId_itemId_createdAt_idx) WHERE storeId = ${storeId} AND itemId = ${itemId} AND createdAt < ${openingCut}
      `)
          : [];
        const before = beforeRows[0];
        let quantity = integer(before?.quantityDelta),
          reserved = integer(before?.reservedDelta);
        if (item.createdAt > period.start && integer(before?.movementCount) !== 0)
          throw new BadRequestException('inventory.trendUnavailable');
        balance(quantity, reserved);
        const byBucket = new Map<number, Aggregate>();
        // Constant bounded index ranges per UNION arm; never load unbounded ledger rows into memory.
        for (let offset = 0; offset < active.length; offset += 32) {
          const statements = active.slice(offset, offset + 32).map(
            (day) => Prisma.sql`
          SELECT ${day.bucket} AS bucket, SUM(quantityAfter - quantityBefore) AS quantityDelta,
            SUM(reservedAfter - reservedBefore) AS reservedDelta,
            SUM(CASE WHEN kind = 'RECEIVE' THEN amount ELSE 0 END) AS received,
            SUM(CASE WHEN kind = 'ISSUE' THEN amount ELSE 0 END) AS issued,
            SUM(CASE WHEN kind = 'LOSS' THEN amount ELSE 0 END) AS lost,
            SUM(CASE WHEN kind = 'COUNT' THEN GREATEST(quantityAfter - quantityBefore, 0) ELSE 0 END) AS countGain,
            SUM(CASE WHEN kind = 'COUNT' THEN GREATEST(quantityBefore - quantityAfter, 0) ELSE 0 END) AS countLoss,
            COUNT(*) AS movementCount
          FROM inventory_movements FORCE INDEX (inventory_movements_storeId_itemId_createdAt_idx) WHERE storeId = ${storeId} AND itemId = ${itemId} AND createdAt >= ${day.effectiveStart} AND createdAt < ${day.effectiveEnd}
        `,
          );
          const aggregates = await tx.$queryRaw<Aggregate[]>(Prisma.join(statements, ' UNION ALL '));
          for (const aggregate of aggregates) byBucket.set(integer(aggregate.bucket), aggregate);
        }
        const totals = { received: 0, issued: 0, lost: 0, countGain: 0, countLoss: 0, movementCount: 0 };
        let firstQuantity: number | null = null,
          firstReserved: number | null = null,
          hasData = false;
        const days: InventoryTrendDay[] = boundaries.map((day, index) => {
          const until = new Date(Math.min(day.end.getTime(), asOf.getTime()));
          if (day.start >= asOf || until <= item.createdAt)
            return {
              date: day.date,
              startAt: day.start.toISOString(),
              endAt: day.end.toISOString(),
              partial: day.partial,
              state: day.start >= asOf ? ('FUTURE' as const) : ('NOT_CREATED' as const),
              opening: null,
              closing: null,
              reservedOpening: null,
              reservedClosing: null,
              availableClosing: null,
              received: 0,
              issued: 0,
              lost: 0,
              countGain: 0,
              countLoss: 0,
              movementCount: 0,
            };
          const aggregate = byBucket.get(index),
            values = {
              received: integer(aggregate?.received),
              issued: integer(aggregate?.issued),
              lost: integer(aggregate?.lost),
              countGain: integer(aggregate?.countGain),
              countLoss: integer(aggregate?.countLoss),
              movementCount: integer(aggregate?.movementCount),
            };
          const delta = integer(aggregate?.quantityDelta),
            reservedDelta = integer(aggregate?.reservedDelta),
            opening = quantity,
            reservedOpening = reserved;
          if (delta !== values.received - values.issued - values.lost + values.countGain - values.countLoss)
            throw new BadRequestException('inventory.trendUnavailable');
          if (!hasData) {
            firstQuantity = quantity;
            firstReserved = reserved;
            hasData = true;
          }
          quantity = integer(quantity + delta);
          reserved = integer(reserved + reservedDelta);
          balance(quantity, reserved);
          for (const key of flows) totals[key] = integer(totals[key] + values[key]);
          return {
            date: day.date,
            startAt: new Date(Math.max(day.start.getTime(), item.createdAt.getTime())).toISOString(),
            endAt: until.toISOString(),
            partial: day.partial || item.createdAt > day.start || until < day.end,
            state: 'RECORDED' as const,
            opening: opening / 1000,
            closing: quantity / 1000,
            reservedOpening: reservedOpening / 1000,
            reservedClosing: reserved / 1000,
            availableClosing: (quantity - reserved) / 1000,
            ...(Object.fromEntries(
              flows.map((key) => [key, key === 'movementCount' ? values[key] : values[key] / 1000]),
            ) as typeof values),
          };
        });
        return {
          storeId,
          item: presentItem(item),
          startAt: period.start.toISOString(),
          endAt: period.end.toISOString(),
          timeZone: period.timeZone,
          asOfAt: asOf.toISOString(),
          generatedAt: new Date().toISOString(),
          summary: {
            opening: firstQuantity === null ? null : firstQuantity / 1000,
            closing: hasData ? quantity / 1000 : null,
            reservedOpening: firstReserved === null ? null : firstReserved / 1000,
            reservedClosing: hasData ? reserved / 1000 : null,
            availableClosing: hasData ? (quantity - reserved) / 1000 : null,
            ...(Object.fromEntries(
              flows.map((key) => [key, key === 'movementCount' ? totals[key] : totals[key] / 1000]),
            ) as typeof totals),
          },
          days,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 },
    );
  }
}
