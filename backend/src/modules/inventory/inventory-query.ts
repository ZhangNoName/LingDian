import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { InventoryHistoryQueryDto, InventoryActivityFilterDto } from './dto/inventory.dto';

export const MAX_REPORT_ITEMS = 10000;
export function activityPeriod(query: InventoryActivityFilterDto, required = false): { start?: Date; end?: Date } {
  const start = query.startAt ? new Date(query.startAt) : undefined;
  const end = query.endAt ? new Date(query.endAt) : undefined;
  if ((required && (!start || !end)) || (start && !Number.isFinite(start.getTime())) || (end && !Number.isFinite(end.getTime())) ||
      (start && end && (start >= end || end.getTime() - start.getTime() > 366 * 86400000))) {
    throw new BadRequestException('inventory.invalidPeriod');
  }
  return { start, end };
}
export function movementWhere(storeId: string, query: InventoryHistoryQueryDto, period: { start?: Date; end?: Date }): Prisma.InventoryMovementWhereInput {
  return {
    storeId,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(period.start || period.end ? { createdAt: { gte: period.start, lt: period.end } } : {}),
    ...(query.keyword ? { item: { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] } } : {}),
  };
}
