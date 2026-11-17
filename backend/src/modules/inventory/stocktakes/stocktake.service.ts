import { lockActiveMaterials } from '../active-materials';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@lingdian/db';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { PrismaService } from '../../../prisma/prisma.service';
import { MerchantStoreScope } from '../../merchant/merchant-store-scope';
import { syncInventoryAlert } from '../inventory-alert-state';
import { CreateStocktakeDto, SaveStocktakeDto, StocktakeQueryDto, StocktakeVersionDto } from './stocktake.dto';
import { presentStocktake, stocktakeInclude } from './stocktake.presenter';
@Injectable()
export class StocktakeService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: MerchantStoreScope,
  ) {}
  async list(user: AuthenticatedUser, storeId: string, query: StocktakeQueryDto) {
    this.scope.assertIncludes(user, storeId);
    const where = {
      storeId,
      ...(query.status && query.status !== 'ALL' ? { status: query.status } : {}),
      ...(query.keyword ? { title: { contains: query.keyword } } : {}),
    };
    return this.db.$transaction(
      async (tx) => ({
        items: (
          await tx.inventoryStocktake.findMany({
            where,
            include: stocktakeInclude,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          })
        ).map(presentStocktake),
        total: await tx.inventoryStocktake.count({ where }),
        page: query.page,
        pageSize: query.pageSize,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async detail(user: AuthenticatedUser, storeId: string, id: string) {
    this.scope.assertIncludes(user, storeId);
    return this.db.$transaction(async (tx) => presentStocktake(await this.record(tx, storeId, id)), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }
  async create(user: AuthenticatedUser, storeId: string, body: CreateStocktakeDto) {
    this.scope.assertIncludes(user, storeId);
    const itemIds = [...body.itemIds].sort();
    if (!itemIds.length || new Set(itemIds).size !== itemIds.length)
      throw new BadRequestException('stocktake.invalidLines');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ actor: user.userId, title: body.title, note: body.note, itemIds }))
      .digest('hex');
    const where = { storeId_requestId: { storeId, requestId: body.requestId } };
    const previous = await this.db.inventoryStocktake.findUnique({ where });
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new ConflictException('stocktake.requestConflict');
      return this.detail(user, storeId, previous.id);
    }
    let id: string;
    try {
      id = await this.db.$transaction(
        async (tx) => {
          await lockActiveMaterials(tx, storeId, itemIds, 'stocktake.itemUnavailable');
          const items = await tx.inventoryItem.findMany({
            where: { storeId, id: { in: itemIds }, isActive: true },
            orderBy: { id: 'asc' },
          });
          if (items.length !== itemIds.length) throw new BadRequestException('stocktake.itemUnavailable');
          const row = await tx.inventoryStocktake.create({
            data: {
              storeId,
              requestId: body.requestId,
              fingerprint,
              title: body.title,
              note: body.note,
              createdBy: user.userId,
              lines: {
                create: items.map((item): Prisma.InventoryStocktakeLineUncheckedCreateWithoutStocktakeInput => ({
                  itemId: item.id,
                  itemName: item.name,
                  itemCode: item.code,
                  unit: item.unit,
                  expectedQuantity: item.quantity,
                  reservedQuantity: item.reservedQuantity,
                  itemVersion: item.version,
                })),
              },
            },
          });
          await this.audit(tx, user, storeId, row.id, 'STOCKTAKE_CREATED');
          return row.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        const committed = await this.db.inventoryStocktake.findUnique({ where });
        if (committed) {
          if (committed.fingerprint !== fingerprint) throw new ConflictException('stocktake.requestConflict');
          return this.detail(user, storeId, committed.id);
        }
      }
      throw error;
    }
    return this.detail(user, storeId, id);
  }
  async save(user: AuthenticatedUser, storeId: string, id: string, body: SaveStocktakeDto) {
    this.scope.assertIncludes(user, storeId);
    await this.db.$transaction(
      async (tx) => {
        const row = await this.draft(tx, storeId, id, body.expectedVersion),
          counts = new Map(body.lines.map((line) => [line.lineId, line.countedQuantity]));
        if (
          counts.size !== body.lines.length ||
          counts.size !== row.lines.length ||
          row.lines.some((line) => !counts.has(line.id))
        )
          throw new BadRequestException('stocktake.invalidLines');
        for (const line of row.lines)
          await tx.inventoryStocktakeLine.update({
            where: { id: line.id },
            data: { countedQuantity: counts.get(line.id) === null ? null : Math.round(counts.get(line.id)! * 1000) },
          });
        await this.audit(tx, user, storeId, id, 'STOCKTAKE_COUNTS_SAVED');
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return this.detail(user, storeId, id);
  }
  async refresh(user: AuthenticatedUser, storeId: string, id: string, body: StocktakeVersionDto) {
    this.scope.assertIncludes(user, storeId);
    await this.db.$transaction(
      async (tx) => {
        const row = await this.draft(tx, storeId, id, body.expectedVersion),
          capturedAt = new Date();
        for (const line of row.lines)
          await tx.inventoryStocktakeLine.update({
            where: { id: line.id },
            data: {
              expectedQuantity: line.item.quantity,
              reservedQuantity: line.item.reservedQuantity,
              itemVersion: line.item.version,
              countedQuantity: null,
              capturedAt,
            },
          });
        await this.audit(tx, user, storeId, id, 'STOCKTAKE_RECOUNT_STARTED');
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return this.detail(user, storeId, id);
  }
  async post(user: AuthenticatedUser, storeId: string, id: string, body: StocktakeVersionDto) {
    this.scope.assertIncludes(user, storeId);
    await this.db.$transaction(
      async (tx) => {
        if ((await this.record(tx, storeId, id)).status === 'POSTED') return;
        const row = await this.draft(tx, storeId, id, body.expectedVersion);
        if (row.lines.some((line) => line.countedQuantity === null))
          throw new BadRequestException('stocktake.incomplete');
        for (const line of row.lines) {
          const item = await tx.inventoryItem.findUniqueOrThrow({
            where: { id_storeId: { id: line.itemId, storeId } },
          });
          if (!item.isActive || item.version !== line.itemVersion) throw new ConflictException('stocktake.stockChanged');
          const quantity = line.countedQuantity!;
          if (quantity < item.reservedQuantity) throw new ConflictException('stocktake.reserved');
          const changed = await tx.inventoryItem.updateMany({
            where: { id: item.id, storeId, isActive: true, version: line.itemVersion },
            data: { quantity, availableQuantity: quantity - item.reservedQuantity, version: { increment: 1 } },
          });
          if (changed.count !== 1) throw new ConflictException('stocktake.stockChanged');
          await tx.inventoryMovement.create({
            data: {
              storeId,
              itemId: item.id,
              stocktakeId: id,
              requestId: `st:${id}:${line.id}`,
              kind: 'COUNT',
              amount: quantity,
              quantityBefore: item.quantity,
              quantityAfter: quantity,
              reservedBefore: item.reservedQuantity,
              reservedAfter: item.reservedQuantity,
              reorderPointBefore: item.reorderPoint,
              reorderPointAfter: item.reorderPoint,
              versionBefore: item.version,
              actorId: user.userId,
              reason: row.note,
            },
          });
          await syncInventoryAlert(tx, { ...item, availableQuantity: quantity - item.reservedQuantity }, user.userId);
        }
        await tx.inventoryStocktake.update({
          where: { id },
          data: { status: 'POSTED', postedAt: new Date(), postedBy: user.userId },
        });
        await this.audit(tx, user, storeId, id, 'STOCKTAKE_POSTED');
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 },
    );
    return this.detail(user, storeId, id);
  }
  async cancel(user: AuthenticatedUser, storeId: string, id: string, body: StocktakeVersionDto) {
    this.scope.assertIncludes(user, storeId);
    await this.db.$transaction(
      async (tx) => {
        if ((await this.record(tx, storeId, id)).status === 'CANCELLED') return;
        await this.draft(tx, storeId, id, body.expectedVersion);
        await tx.inventoryStocktake.update({
          where: { id },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: user.userId },
        });
        await this.audit(tx, user, storeId, id, 'STOCKTAKE_CANCELLED');
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return this.detail(user, storeId, id);
  }
  private async record(tx: Prisma.TransactionClient, storeId: string, id: string) {
    const row = await tx.inventoryStocktake.findUnique({
      where: { id_storeId: { id, storeId } },
      include: stocktakeInclude,
    });
    if (!row) throw new NotFoundException('stocktake.notFound');
    return row;
  }
  private async draft(tx: Prisma.TransactionClient, storeId: string, id: string, version: number) {
    const updated = await tx.inventoryStocktake.updateMany({
      where: { id, storeId, version, status: 'DRAFT' },
      data: { version: { increment: 1 } },
    });
    if (updated.count !== 1) {
      const row = await this.record(tx, storeId, id);
      throw new ConflictException(row.status !== 'DRAFT' ? 'stocktake.closed' : 'stocktake.stale');
    }
    return this.record(tx, storeId, id);
  }
  private audit(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    storeId: string,
    stocktakeId: string,
    event: string,
  ) {
    return tx.authAuditLog.create({
      data: { event, userId: user.userId, sessionId: user.sessionId, metadata: { storeId, stocktakeId } },
    });
  }
}
