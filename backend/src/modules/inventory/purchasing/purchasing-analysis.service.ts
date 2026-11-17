import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { PurchaseReceiptReport, ReplenishmentSnapshot } from '@lingdian/contracts';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { PrismaService } from '../../../prisma/prisma.service';
import { MerchantStoreScope } from '../../merchant/merchant-store-scope';
import { activityPeriod, MAX_REPORT_ITEMS } from '../inventory-query';
import { PurchaseReportQueryDto, ReplenishmentQueryDto } from './purchasing-analysis.dto';
import { safeInteger, summarizeReceipts } from './purchasing-analysis';
import { pendingPurchaseLines } from './pending-purchase-lines';
@Injectable()
export class PurchasingAnalysisService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: MerchantStoreScope,
  ) {}
  async report(
    user: AuthenticatedUser,
    storeId: string,
    query: PurchaseReportQueryDto,
  ): Promise<PurchaseReceiptReport> {
    this.scope.assertIncludes(user, storeId);
    const { start, end } = activityPeriod(query, true);
    return this.db.$transaction(
      async (tx) => {
        const where: Prisma.PurchaseReceiptLineWhereInput = {
          storeId,
          orderLine: { storeId, ...(query.itemId ? { itemId: query.itemId } : {}) },
          receipt: {
            storeId,
            createdAt: { gte: start, lt: end },
            order: { storeId, ...(query.supplierId ? { supplierId: query.supplierId } : {}) },
          },
          ...(query.keyword
            ? {
                OR: [
                  {
                    orderLine: {
                      OR: [{ itemName: { contains: query.keyword } }, { itemCode: { contains: query.keyword } }],
                    },
                  },
                  {
                    receipt: {
                      order: {
                        OR: [
                          { orderNo: { contains: query.keyword } },
                          { supplierName: { contains: query.keyword } },
                          { supplierCode: { contains: query.keyword } },
                        ],
                      },
                    },
                  },
                ],
              }
            : {}),
        };
        const lines = await tx.purchaseReceiptLine.findMany({
          where,
          include: {
            orderLine: true,
            receipt: {
              include: {
                order: {
                  select: { id: true, orderNo: true, supplierId: true, supplierName: true, supplierCode: true },
                },
              },
            },
          },
          orderBy: [{ receipt: { createdAt: 'asc' } }, { id: 'asc' }],
          take: MAX_REPORT_ITEMS + 1,
        });
        if (lines.length > MAX_REPORT_ITEMS) throw new BadRequestException('purchasing.reportTooLarge');
        const rows = lines.map((line) => ({
          receiptId: line.receiptId,
          orderId: line.receipt.order.id,
          orderNo: line.receipt.order.orderNo,
          receivedAt: line.receipt.createdAt.toISOString(),
          supplierId: line.receipt.order.supplierId,
          supplierName: line.receipt.order.supplierName,
          supplierCode: line.receipt.order.supplierCode,
          itemId: line.orderLine.itemId,
          itemName: line.orderLine.itemName,
          itemCode: line.orderLine.itemCode,
          unit: line.orderLine.unit,
          quantity: line.quantity / 1000,
          unitPriceCents: line.orderLine.unitPriceCents,
          costCents: safeInteger(line.costCents),
          actorId: line.receipt.actorId,
          note: line.receipt.note,
        }));
        return {
          storeId,
          startAt: start!.toISOString(),
          endAt: end!.toISOString(),
          generatedAt: new Date().toISOString(),
          currency: 'CNY',
          ...summarizeReceipts(rows),
          rows,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 },
    );
  }
  async replenishment(
    user: AuthenticatedUser,
    storeId: string,
    query: ReplenishmentQueryDto,
  ): Promise<ReplenishmentSnapshot> {
    this.scope.assertIncludes(user, storeId);
    return this.db.$transaction(
      async (tx) => {
        const items = await tx.inventoryItem.findMany({
          where: {
            storeId,
            isActive: true,
            ...(query.itemId ? { id: query.itemId } : {}),
            ...(query.keyword
              ? { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] }
              : {}),
          },
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
          take: MAX_REPORT_ITEMS + 1,
        });
        if (items.length > MAX_REPORT_ITEMS) throw new BadRequestException('purchasing.reportTooLarge');
        const pending = items.length
          ? await tx.purchaseOrderLine.groupBy({
              by: ['itemId'],
              where: {
                ...pendingPurchaseLines(tx, storeId),
                itemId: { in: items.map((item) => item.id) },
              },
              _sum: { quantity: true, receivedQuantity: true },
              _count: { _all: true },
            })
          : [];
        const pendingByItem = new Map(
          pending.map((row) => [
            row.itemId,
            {
              quantity: safeInteger(row._sum.quantity ?? 0) - safeInteger(row._sum.receivedQuantity ?? 0),
              count: row._count._all,
            },
          ]),
        );
        const rows = items.map((item) => {
          const onOrder = pendingByItem.get(item.id);
          const shortage = Math.max(0, item.reorderPoint - item.availableQuantity),
            pendingQuantity = Math.max(0, onOrder?.quantity ?? 0);
          return {
            id: item.id,
            storeId,
            code: item.code,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity / 1000,
            reservedQuantity: item.reservedQuantity / 1000,
            availableQuantity: item.availableQuantity / 1000,
            reorderPoint: item.reorderPoint / 1000,
            shortage: shortage / 1000,
            version: item.version,
            updatedAt: item.updatedAt.toISOString(),
            status:
              item.availableQuantity === 0
                ? ('OUT' as const)
                : item.availableQuantity <= item.reorderPoint
                  ? ('LOW' as const)
                  : ('HEALTHY' as const),
            pendingQuantity: pendingQuantity / 1000,
            pendingOrderCount: onOrder?.count ?? 0,
            recommendedQuantity: Math.max(0, shortage - pendingQuantity) / 1000,
          };
        });
        return {
          storeId,
          generatedAt: new Date().toISOString(),
          rows,
          summary: {
            materialCount: rows.length,
            shortageCount: rows.filter((row) => row.shortage > 0).length,
            coveredCount: rows.filter((row) => row.shortage > 0 && row.recommendedQuantity === 0).length,
            neededCount: rows.filter((row) => row.recommendedQuantity > 0).length,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 },
    );
  }
}
