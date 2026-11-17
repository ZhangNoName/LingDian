import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@lingdian/db';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { MerchantStoreScope } from '../../merchant/merchant-store-scope';
import { PrismaService } from '../../../prisma/prisma.service';
import { syncInventoryAlert } from '../inventory-alert-state';
import {
  CancelPurchaseDto,
  CreatePurchaseDto,
  PurchasingQueryDto,
  PurchaseOrderQueryDto,
  ReceivePurchaseDto,
} from './purchasing.dto';
import { purchaseDeliveryWhere } from './purchase-delivery';
import { pendingPurchaseLines } from './pending-purchase-lines';
import {
  assertReplay,
  cents,
  distinct,
  fingerprint,
  lineCost,
  orderInclude,
  presentOrder,
  presentReceipt,
  race,
  receiptInclude,
  scale,
  serializableError,
} from './purchasing-policy';
@Injectable()
export class PurchasingService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: MerchantStoreScope,
  ) {}
  async list(user: AuthenticatedUser, storeId: string, query: PurchaseOrderQueryDto) {
    this.scope.assertIncludes(user, storeId);
    const where: Prisma.PurchaseOrderWhereInput = {
      storeId,
      ...purchaseDeliveryWhere(query),
      ...(query.pendingItemId ? { lines: { some: pendingPurchaseLines(this.db, storeId, query.pendingItemId) } } : {}),
      ...(query.status && query.status !== 'ALL'
        ? { status: query.status === 'ACTIVE' ? { in: ['OPEN', 'PARTIAL'] } : query.status }
        : {}),
      ...(query.keyword
        ? {
            OR: [
              { orderNo: { contains: query.keyword } },
              { supplierName: { contains: query.keyword } },
              {
                lines: {
                  some: { OR: [{ itemName: { contains: query.keyword } }, { itemCode: { contains: query.keyword } }] },
                },
              },
            ],
          }
        : {}),
    };
    return this.db.$transaction(
      async (tx) => ({
        items: (
          await tx.purchaseOrder.findMany({
            where,
            include: orderInclude,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          })
        ).map(presentOrder),
        total: await tx.purchaseOrder.count({ where }),
        page: query.page,
        pageSize: query.pageSize,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async detail(user: AuthenticatedUser, storeId: string, id: string) {
    this.scope.assertIncludes(user, storeId);
    const order = await this.db.purchaseOrder.findUnique({
      where: { id_storeId: { id, storeId } },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('purchasing.notFound');
    return presentOrder(order);
  }
  async receipts(user: AuthenticatedUser, storeId: string, id: string, query: PurchasingQueryDto) {
    this.scope.assertIncludes(user, storeId);
    return this.db.$transaction(
      async (tx) => {
        if (!(await tx.purchaseOrder.findUnique({ where: { id_storeId: { id, storeId } } })))
          throw new NotFoundException('purchasing.notFound');
        const where = { orderId: id, storeId };
        return {
          items: (
            await tx.purchaseReceipt.findMany({
              where,
              include: receiptInclude,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              skip: (query.page - 1) * query.pageSize,
              take: query.pageSize,
            })
          ).map(presentReceipt),
          total: await tx.purchaseReceipt.count({ where }),
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async create(user: AuthenticatedUser, storeId: string, body: CreatePurchaseDto) {
    this.scope.assertIncludes(user, storeId);
    distinct(body.lines.map((line) => line.itemId));
    const hash = fingerprint({
      actor: user.userId,
      supplier: body.supplierId,
      note: body.note,
      expectedAt: body.expectedAt ? new Date(body.expectedAt).toISOString() : null,
      lines: body.lines
        .map((line) => ({
          itemId: line.itemId,
          quantity: scale(line.quantity),
          unitPriceCents: Math.round(line.unitPrice * 100),
        }))
        .sort((a, b) => a.itemId.localeCompare(b.itemId)),
    });
    const key = { storeId_requestId: { storeId, requestId: body.requestId } };
    const replay = await this.db.purchaseOrder.findUnique({ where: key, include: orderInclude });
    if (replay) {
      assertReplay(replay, hash);
      return presentOrder(replay);
    }
    try {
      return await this.db.$transaction(
        async (tx) => {
          const locked = await tx.supplier.updateMany({
            where: { id: body.supplierId, storeId, isActive: true },
            data: { version: { increment: 0 } },
          });
          if (locked.count !== 1) throw new BadRequestException('purchasing.supplierUnavailable');
          const supplier = await tx.supplier.findUniqueOrThrow({
            where: { id_storeId: { id: body.supplierId, storeId } },
          });
          const items = await tx.inventoryItem.findMany({
            where: { id: { in: body.lines.map((line) => line.itemId) }, storeId },
          });
          if (items.length !== body.lines.length) throw new BadRequestException('purchasing.materialUnavailable');
          const lines = body.lines.map((line) => {
            const item = items.find((item) => item.id === line.itemId)!;
            return {
              itemId: item.id,
              itemName: item.name,
              itemCode: item.code,
              unit: item.unit,
              quantity: scale(line.quantity),
              unitPriceCents: Math.round(line.unitPrice * 100),
            };
          });
          const total = lines.reduce((sum, line) => sum + lineCost(line.quantity, line.unitPriceCents), 0n);
          cents(total);
          const order = await tx.purchaseOrder.create({
            data: {
              storeId,
              supplierId: supplier.id,
              supplierName: supplier.name,
              supplierCode: supplier.code,
              orderNo: `PO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(6).toString('hex').toUpperCase()}`,
              requestId: body.requestId,
              fingerprint: hash,
              note: body.note,
              expectedAt: body.expectedAt ? new Date(body.expectedAt) : null,
              createdBy: user.userId,
              totalCostCents: total,
              lines: { create: lines },
            },
            include: orderInclude,
          });
          await this.audit(tx, user, storeId, 'PURCHASE_CREATED', order.id, { totalCostCents: cents(total) });
          return presentOrder(order);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 },
      );
    } catch (error) {
      if (race(error)) {
        const committed = await this.db.purchaseOrder.findUnique({ where: key, include: orderInclude });
        if (committed) {
          assertReplay(committed, hash);
          return presentOrder(committed);
        }
      }
      return serializableError(error);
    }
  }
  async receive(user: AuthenticatedUser, storeId: string, id: string, body: ReceivePurchaseDto) {
    this.scope.assertIncludes(user, storeId);
    distinct(body.lines.map((line) => line.lineId));
    const hash = fingerprint({
      actor: user.userId,
      orderId: id,
      expectedVersion: body.expectedVersion,
      note: body.note,
      lines: body.lines
        .map((line) => ({ lineId: line.lineId, quantity: scale(line.quantity) }))
        .sort((a, b) => a.lineId.localeCompare(b.lineId)),
    });
    const key = { storeId_requestId: { storeId, requestId: body.requestId } };
    const replay = await this.db.purchaseReceipt.findUnique({ where: key, include: receiptInclude });
    if (replay) {
      assertReplay(replay, hash);
      return presentReceipt(replay);
    }
    try {
      return await this.db.$transaction(
        async (tx) => {
          const found = await tx.purchaseOrder.findUnique({ where: { id_storeId: { id, storeId } } });
          if (!found) throw new NotFoundException('purchasing.notFound');
          const locked = await tx.purchaseOrder.updateMany({
            where: { id, storeId, version: body.expectedVersion, status: { in: ['OPEN', 'PARTIAL'] } },
            data: { version: { increment: 1 } },
          });
          if (locked.count !== 1) throw new ConflictException('purchasing.stale');
          const order = await tx.purchaseOrder.findUniqueOrThrow({
            where: { id_storeId: { id, storeId } },
            include: orderInclude,
          });
          const lines = body.lines
            .map((line) => {
              const original = order.lines.find((old) => old.id === line.lineId);
              if (!original) throw new BadRequestException('purchasing.materialUnavailable');
              const amount = scale(line.quantity);
              if (amount > original.quantity - original.receivedQuantity)
                throw new ConflictException('purchasing.overReceive');
              return { original, amount, cost: lineCost(amount, original.unitPriceCents) };
            })
            .sort((a, b) => a.original.itemId.localeCompare(b.original.itemId));
          const total = lines.reduce((sum, line) => sum + line.cost, 0n);
          cents(total + order.receivedCostCents);
          const receipt = await tx.purchaseReceipt.create({
            data: {
              storeId,
              orderId: id,
              requestId: body.requestId,
              fingerprint: hash,
              note: body.note,
              actorId: user.userId,
              totalCostCents: total,
              lines: {
                create: lines.map((line) => ({
                  orderLineId: line.original.id,
                  quantity: line.amount,
                  costCents: line.cost,
                })),
              },
            },
            include: receiptInclude,
          });
          for (const line of lines) {
            const itemId = line.original.itemId;
            const itemLock = await tx.inventoryItem.updateMany({
              where: { id: itemId, storeId },
              data: { version: { increment: 0 } },
            });
            if (itemLock.count !== 1) throw new BadRequestException('purchasing.materialUnavailable');
            const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id_storeId: { id: itemId, storeId } } });
            const next = item.quantity + line.amount;
            if (next > 999999000) throw new BadRequestException('purchasing.tooLarge');
            await tx.inventoryItem.update({
              where: { id: itemId },
              data: { quantity: next, availableQuantity: next - item.reservedQuantity, version: { increment: 1 } },
            });
            await tx.inventoryMovement.create({
              data: {
                storeId,
                itemId,
                purchaseReceiptId: receipt.id,
                requestId: `purchase:${receipt.id}:${line.original.id}`,
                kind: 'RECEIVE',
                amount: line.amount,
                quantityBefore: item.quantity,
                quantityAfter: next,
                reservedBefore: item.reservedQuantity,
                reservedAfter: item.reservedQuantity,
                reorderPointBefore: item.reorderPoint,
                reorderPointAfter: item.reorderPoint,
                versionBefore: item.version,
                actorId: user.userId,
                reason: `${order.orderNo} / ${receipt.id}`,
              },
            });
            await tx.purchaseOrderLine.update({
              where: { id: line.original.id },
              data: { receivedQuantity: { increment: line.amount } },
            });
            await syncInventoryAlert(tx, { ...item, availableQuantity: next - item.reservedQuantity }, user.userId);
          }
          const complete = order.lines.every(
            (line) =>
              line.receivedQuantity + (lines.find((change) => change.original.id === line.id)?.amount ?? 0) ===
              line.quantity,
          );
          await tx.purchaseOrder.update({
            where: { id },
            data: { status: complete ? 'RECEIVED' : 'PARTIAL', receivedCostCents: { increment: total } },
          });
          await this.audit(tx, user, storeId, 'PURCHASE_RECEIVED', id, {
            receiptId: receipt.id,
            totalCostCents: cents(total),
          });
          return presentReceipt(receipt);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 },
      );
    } catch (error) {
      if (race(error)) {
        const committed = await this.db.purchaseReceipt.findUnique({ where: key, include: receiptInclude });
        if (committed) {
          assertReplay(committed, hash);
          return presentReceipt(committed);
        }
      }
      return serializableError(error);
    }
  }
  async cancel(user: AuthenticatedUser, storeId: string, id: string, body: CancelPurchaseDto) {
    this.scope.assertIncludes(user, storeId);
    return this.db.$transaction(
      async (tx) => {
        const order = await tx.purchaseOrder.findUnique({
          where: { id_storeId: { id, storeId } },
          include: orderInclude,
        });
        if (!order) throw new NotFoundException('purchasing.notFound');
        if (
          order.status === 'CANCELLED' &&
          order.version === body.expectedVersion + 1 &&
          order.cancelledBy === user.userId &&
          order.cancelReason === body.note
        )
          return presentOrder(order);
        const locked = await tx.purchaseOrder.updateMany({
          where: { id, storeId, version: body.expectedVersion, status: { in: ['OPEN', 'PARTIAL'] } },
          data: {
            status: 'CANCELLED',
            version: { increment: 1 },
            cancelledAt: new Date(),
            cancelledBy: user.userId,
            cancelReason: body.note,
          },
        });
        if (locked.count !== 1) throw new ConflictException('purchasing.stale');
        await this.audit(tx, user, storeId, 'PURCHASE_CANCELLED', id, { reason: body.note });
        return presentOrder(
          await tx.purchaseOrder.findUniqueOrThrow({ where: { id_storeId: { id, storeId } }, include: orderInclude }),
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
  private audit(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    storeId: string,
    event: string,
    orderId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    return tx.authAuditLog.create({
      data: { event, userId: user.userId, sessionId: user.sessionId, metadata: { storeId, orderId, ...metadata } },
    });
  }
}
