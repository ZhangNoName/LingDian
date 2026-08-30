import { ConflictException } from '@nestjs/common';
import { OrderSource, Prisma } from '@lingdian/db';

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

export const PICKUP_CODE_FORMATS = Object.freeze({
  MINIAPP: { prefix: 'U-', width: 4 },
  MEITUAN_WAIMAI: { prefix: 'MT-', width: 5 },
  JD_DAOJIA: { prefix: 'JD-', width: 6 },
  POS: { prefix: 'S-', width: 4 },
  MANUAL: { prefix: 'A-', width: 5 },
} satisfies Record<OrderSource, { prefix: string; width: number }>);

export interface AllocatePickupCodeInput {
  storeId: string;
  orderSource: OrderSource;
  /** The actual or scheduled fulfillment instant. Defaults to the current time. */
  fulfillmentAt?: Date;
}

export interface AllocatedPickupCode {
  pickupCode: string;
  /** UTC midnight carrying the Shanghai calendar date for Prisma's DATE column. */
  pickupBusinessDate: Date;
  sequence: number;
}

const shanghaiDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SHANGHAI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Converts an instant into the calendar date observed in Asia/Shanghai.
 * The returned Date is UTC midnight so Prisma can persist it losslessly to a MySQL DATE.
 */
export function toShanghaiBusinessDate(instant: Date = new Date()): Date {
  if (Number.isNaN(instant.getTime())) {
    throw new TypeError('fulfillmentAt must be a valid Date');
  }

  const parts = shanghaiDateFormatter.formatToParts(instant);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new TypeError('Unable to resolve the Shanghai business date');
  }

  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

/**
 * Atomically allocates a pickup code inside the caller's Prisma transaction.
 *
 * Capacity failures must escape the transaction callback so the increment is rolled back.
 * Do not catch and suppress the ConflictException inside that transaction.
 */
export async function allocatePickupCode(
  tx: Prisma.TransactionClient,
  input: AllocatePickupCodeInput,
): Promise<AllocatedPickupCode> {
  const format = PICKUP_CODE_FORMATS[input.orderSource];
  if (!format) {
    throw new TypeError(`Unsupported order source: ${String(input.orderSource)}`);
  }

  const pickupBusinessDate = toShanghaiBusinessDate(input.fulfillmentAt);
  const sequence = await tx.pickupCodeSequence.upsert({
    where: {
      storeId_businessDate_orderSource: {
        storeId: input.storeId,
        businessDate: pickupBusinessDate,
        orderSource: input.orderSource,
      },
    },
    create: {
      storeId: input.storeId,
      businessDate: pickupBusinessDate,
      orderSource: input.orderSource,
      lastValue: 1,
    },
    update: {
      lastValue: { increment: 1 },
    },
    select: {
      lastValue: true,
    },
  });

  const maximum = (10 ** format.width) - 1;
  if (sequence.lastValue > maximum) {
    throw new ConflictException(
      `Pickup code capacity exhausted for ${input.orderSource} on ${formatBusinessDate(pickupBusinessDate)}`,
    );
  }

  return {
    pickupCode: `${format.prefix}${String(sequence.lastValue).padStart(format.width, '0')}`,
    pickupBusinessDate,
    sequence: sequence.lastValue,
  };
}

function formatBusinessDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
