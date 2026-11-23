import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@lingdian/db';
import type { PurchaseDeliveryQuery } from '@lingdian/contracts';

/** Follow-up is for active orders only; compose with caller status and material filters. */
export function purchaseDeliveryWhere(query: PurchaseDeliveryQuery): Prisma.PurchaseOrderWhereInput {
  const active = { status: { in: ['OPEN', 'PARTIAL'] } };
  if (query.delivery === 'BEFORE') {
    if (!query.expectedBefore || !/(?:Z|[+-]\d{2}:\d{2})$/.test(query.expectedBefore) || !Number.isFinite(Date.parse(query.expectedBefore)))
      throw new BadRequestException('purchasing.invalidDelivery');
    return { AND: [active, { expectedAt: { lt: new Date(query.expectedBefore) } }] };
  }
  if (query.expectedBefore) throw new BadRequestException('purchasing.invalidDelivery');
  return query.delivery === 'UNDATED' ? { AND: [active, { expectedAt: null }] } : {};
}
