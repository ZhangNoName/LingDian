import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { OrderSource } from '@lingdian/db';
import {
  allocatePickupCode,
  PICKUP_CODE_FORMATS,
  toShanghaiBusinessDate,
} from './pickup-code.service';

test('pickup code formats are distinct per order source', async () => {
  const cases: Array<[OrderSource, number, string]> = [
    [OrderSource.MINIAPP, 23, 'U-0023'],
    [OrderSource.MEITUAN_WAIMAI, 8231, 'MT-08231'],
    [OrderSource.JD_DAOJIA, 381920, 'JD-381920'],
    [OrderSource.POS, 188, 'S-0188'],
    [OrderSource.MANUAL, 65, 'A-00065'],
  ];

  for (const [orderSource, lastValue, expected] of cases) {
    let upsertArgs: any;
    const tx = {
      pickupCodeSequence: {
        upsert: async (args: any) => {
          upsertArgs = args;
          return { lastValue };
        },
      },
    };

    const allocated = await allocatePickupCode(tx as never, {
      storeId: 'store-1',
      orderSource,
      fulfillmentAt: new Date('2026-08-29T10:00:00.000Z'),
    });

    assert.equal(allocated.pickupCode, expected);
    assert.equal(allocated.sequence, lastValue);
    assert.equal(allocated.pickupBusinessDate.toISOString(), '2026-08-29T00:00:00.000Z');
    assert.deepEqual(upsertArgs.where.storeId_businessDate_orderSource, {
      storeId: 'store-1',
      businessDate: new Date('2026-08-29T00:00:00.000Z'),
      orderSource,
    });
    assert.equal(upsertArgs.create.lastValue, 1);
    assert.deepEqual(upsertArgs.update.lastValue, { increment: 1 });
  }
});

test('business date changes at midnight in Asia/Shanghai', () => {
  assert.equal(
    toShanghaiBusinessDate(new Date('2026-08-28T15:59:59.999Z')).toISOString(),
    '2026-08-28T00:00:00.000Z',
  );
  assert.equal(
    toShanghaiBusinessDate(new Date('2026-08-28T16:00:00.000Z')).toISOString(),
    '2026-08-29T00:00:00.000Z',
  );
});

test('each source configuration uses the required width and capacity', () => {
  assert.deepEqual(PICKUP_CODE_FORMATS, {
    MINIAPP: { prefix: 'U-', width: 4 },
    MEITUAN_WAIMAI: { prefix: 'MT-', width: 5 },
    JD_DAOJIA: { prefix: 'JD-', width: 6 },
    POS: { prefix: 'S-', width: 4 },
    MANUAL: { prefix: 'A-', width: 5 },
  });
});

test('capacity exhaustion aborts allocation with a conflict', async () => {
  const tx = {
    pickupCodeSequence: {
      upsert: async () => ({ lastValue: 10_000 }),
    },
  };

  await assert.rejects(
    () => allocatePickupCode(tx as never, {
      storeId: 'store-1',
      orderSource: OrderSource.MINIAPP,
      fulfillmentAt: new Date('2026-08-29T10:00:00.000Z'),
    }),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.match(error.message, /MINIAPP.*2026-08-29/);
      return true;
    },
  );
});

test('invalid fulfillment dates are rejected before incrementing the sequence', async () => {
  let upsertCalled = false;
  const tx = {
    pickupCodeSequence: {
      upsert: async () => {
        upsertCalled = true;
        return { lastValue: 1 };
      },
    },
  };

  await assert.rejects(
    () => allocatePickupCode(tx as never, {
      storeId: 'store-1',
      orderSource: OrderSource.MINIAPP,
      fulfillmentAt: new Date(Number.NaN),
    }),
    /valid Date/,
  );
  assert.equal(upsertCalled, false);
});
