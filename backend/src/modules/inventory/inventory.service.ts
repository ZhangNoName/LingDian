import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { InventoryItemContract, InventoryMovementContract, InventoryMovementKind, InventoryPage, InventoryMovementPage } from '@lingdian/contracts';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { activityPeriod, movementWhere } from './inventory-query';
import { AdjustInventoryDto, CreateInventoryItemDto, InventoryHistoryQueryDto, InventoryQueryDto } from './dto/inventory.dto';

type Item = Prisma.InventoryItemGetPayload<Prisma.InventoryItemDefaultArgs>;
type Movement = Prisma.InventoryMovementGetPayload<{ include: { item: true } }>;
const MAX_QUANTITY = 999999000;
const scaled = (value: number) => Math.round(value * 1000);

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService, private readonly scope: MerchantStoreScope) {}

  async list(user: AuthenticatedUser, storeId: string, query: InventoryQueryDto): Promise<InventoryPage> {
    this.scope.assertIncludes(user, storeId);
    const fields = this.prisma.inventoryItem.fields;
    const statusWhere: Prisma.InventoryItemWhereInput = query.status === 'OUT'
      ? { availableQuantity: 0 }
      : query.status === 'LOW'
        ? { availableQuantity: { gt: 0, lte: fields.reorderPoint } }
        : query.status === 'HEALTHY' ? { availableQuantity: { gt: fields.reorderPoint } } : {};
    const where: Prisma.InventoryItemWhereInput = {
      storeId, ...statusWhere,
      ...(query.keyword ? { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] } : {}),
    };
    // One snapshot for the table and counters; counters intentionally cover the entire store.
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.inventoryItem.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize });
      const total = await tx.inventoryItem.count({ where });
      const all = await tx.inventoryItem.count({ where: { storeId } });
      const low = await tx.inventoryItem.count({ where: { storeId, availableQuantity: { gt: 0, lte: fields.reorderPoint } } });
      const out = await tx.inventoryItem.count({ where: { storeId, availableQuantity: 0 } });
      return { items: items.map(presentItem), total, page: query.page, pageSize: query.pageSize, summary: { total: all, low, out } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async create(user: AuthenticatedUser, storeId: string, body: CreateInventoryItemDto): Promise<InventoryItemContract> {
    this.scope.assertIncludes(user, storeId);
    try {
      const item = await this.prisma.inventoryItem.create({ data: {
        storeId, code: body.code.toUpperCase(), name: body.name, unit: body.unit, reorderPoint: scaled(body.reorderPoint),
      } });
      return presentItem(item);
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) throw new ConflictException('inventory.codeExists');
      throw error;
    }
  }

  async adjust(user: AuthenticatedUser, storeId: string, itemId: string, body: AdjustInventoryDto): Promise<InventoryMovementContract> {
    // Check access before even looking up a replayed idempotency key.
    this.scope.assertIncludes(user, storeId);
    const amount = scaled(body.amount);
    if ((body.kind === 'RECEIVE' || body.kind === 'ISSUE' || body.kind === 'LOSS') && amount === 0) {
      throw new BadRequestException('inventory.positiveAmount');
    }
    const existing = await this.prisma.inventoryMovement.findUnique({ where: { storeId_requestId: { storeId, requestId: body.requestId } }, include: { item: true } });
    if (existing) return replay(existing, itemId, user.userId, body);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUnique({ where: { id_storeId: { id: itemId, storeId } } });
        if (!item) throw new NotFoundException('inventory.notFound');
        if (item.version !== body.expectedVersion) throw new ConflictException('inventory.stale');
        const next = body.kind === 'RECEIVE' ? item.quantity + amount
          : body.kind === 'ISSUE' || body.kind === 'LOSS' ? item.quantity - amount
          : body.kind === 'COUNT' ? amount : item.quantity;
        if (next < 0) throw new ConflictException('inventory.insufficient');
        if (next < item.reservedQuantity) throw new ConflictException('inventory.reserved');
        if (next > MAX_QUANTITY) throw new BadRequestException('inventory.tooLarge');
        const reorderPoint = body.kind === 'THRESHOLD' ? amount : item.reorderPoint;
        // Compare-and-swap serializes all item writers, including threshold edits.
        const updated = await tx.inventoryItem.updateMany({
          where: { id: itemId, storeId, version: body.expectedVersion },
          data: { quantity: next, availableQuantity: next - item.reservedQuantity, reorderPoint, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new ConflictException('inventory.stale');
        const movement = await tx.inventoryMovement.create({ data: {
          storeId, itemId, requestId: body.requestId, kind: body.kind, amount,
          quantityBefore: item.quantity, quantityAfter: next, reservedBefore: item.reservedQuantity, reservedAfter: item.reservedQuantity,
          reorderPointBefore: item.reorderPoint, reorderPointAfter: reorderPoint,
          versionBefore: item.version, actorId: user.userId, reason: body.reason,
        }, include: { item: true } });
        return presentMovement(movement);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      // A concurrent copy may have committed while this request waited on the item row.
      if (isPrismaCode(error, 'P2002') || isPrismaCode(error, 'P2034') || error instanceof ConflictException) {
        const committed = await this.prisma.inventoryMovement.findUnique({ where: { storeId_requestId: { storeId, requestId: body.requestId } }, include: { item: true } });
        if (committed) return replay(committed, itemId, user.userId, body);
        if (isPrismaCode(error, 'P2034')) throw new ConflictException('inventory.stale');
      }
      throw error;
    }
  }

  async history(user: AuthenticatedUser, storeId: string, query: InventoryHistoryQueryDto): Promise<InventoryMovementPage> {
    this.scope.assertIncludes(user, storeId);
    const where = movementWhere(storeId, query, activityPeriod(query));
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.inventoryMovement.findMany({ where, include: { item: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize });
      const total = await tx.inventoryMovement.count({ where });
      return { items: items.map(presentMovement), total, page: query.page, pageSize: query.pageSize };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function replay(movement: Movement, itemId: string, actorId: string, body: AdjustInventoryDto): InventoryMovementContract {
  if (movement.itemId !== itemId || movement.actorId !== actorId || movement.kind !== body.kind ||
      movement.amount !== scaled(body.amount) || movement.reason !== body.reason || movement.versionBefore !== body.expectedVersion) {
    throw new ConflictException('inventory.requestConflict');
  }
  return presentMovement(movement);
}

function presentItem(item: Item): InventoryItemContract {
  return { id: item.id, storeId: item.storeId, code: item.code, name: item.name, unit: item.unit, version: item.version, quantity: item.quantity / 1000, reorderPoint: item.reorderPoint / 1000,
    reservedQuantity: item.reservedQuantity / 1000, availableQuantity: item.availableQuantity / 1000,
    shortage: Math.max(0, item.reorderPoint - item.availableQuantity) / 1000,
    status: item.availableQuantity === 0 ? 'OUT' : item.availableQuantity <= item.reorderPoint ? 'LOW' : 'HEALTHY',
    updatedAt: item.updatedAt.toISOString(),
  };
}

function presentMovement(movement: Movement): InventoryMovementContract {
  return { id: movement.id, itemId: movement.itemId, itemName: movement.item.name, itemCode: movement.item.code, unit: movement.item.unit,
    kind: movement.kind as InventoryMovementKind, amount: movement.amount / 1000,
    quantityBefore: movement.quantityBefore / 1000, quantityAfter: movement.quantityAfter / 1000,
    reservedBefore: movement.reservedBefore / 1000, reservedAfter: movement.reservedAfter / 1000,
    reorderPointBefore: movement.reorderPointBefore / 1000, reorderPointAfter: movement.reorderPointAfter / 1000,
    actorId: movement.actorId, reason: movement.reason, createdAt: movement.createdAt.toISOString(),
  };
}
