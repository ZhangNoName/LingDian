import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { InventoryService } from './inventory.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import type { AdjustInventoryDto } from './dto/inventory.dto';

const user: AuthenticatedUser = { userId: 'merchant-a', sessionId: 's', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ['store-a'] };
const scope = new MerchantStoreScope({ resolveStoreIds: (ids: string[]) => ids } as never);
const request = (overrides: Partial<AdjustInventoryDto> = {}): AdjustInventoryDto => ({ requestId: 'request-0001', kind: 'ISSUE', amount: 0.125, expectedVersion: 0, reason: 'Kitchen use', ...overrides });

function fixture() {
  let item = { id: 'item-a', storeId: 'store-a', code: 'FLOUR', name: 'Flour', unit: 'kg', quantity: 1000, reorderPoint: 500, version: 0, createdAt: new Date(), updatedAt: new Date() };
  const ledger: any[] = [];
  let calls = 0;
  let loseCas = false;
  const tx = {
    inventoryItem: {
      findUnique: async ({ where }: any) => { calls++; return where.id_storeId.id === item.id && where.id_storeId.storeId === item.storeId ? { ...item } : null; },
      updateMany: async ({ where, data }: any) => {
        calls++;
        if (loseCas || where.storeId !== item.storeId || where.id !== item.id || where.version !== item.version) return { count: 0 };
        item = { ...item, quantity: data.quantity, reorderPoint: data.reorderPoint, version: item.version + 1 };
        return { count: 1 };
      },
    },
    inventoryMovement: {
      findUnique: async ({ where }: any) => { calls++; return ledger.find((row) => row.storeId === where.storeId_requestId.storeId && row.requestId === where.storeId_requestId.requestId) ?? null; },
      create: async ({ data }: any) => {
        calls++;
        const row = { ...data, id: `movement-${ledger.length}`, createdAt: new Date(), item: { ...item } };
        ledger.push(row);
        return row;
      },
    },
  };
  const prisma = { ...tx, $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) };
  return { service: new InventoryService(prisma as never, scope), ledger, item: () => item, calls: () => calls, loseCas: () => { loseCas = true; } };
}

test('inventory rejects unauthorized store before reads, writes or idempotency lookup', async () => {
  const f = fixture();
  await assert.rejects(f.service.adjust(user, 'store-b', 'item-a', request()), /not authorized/);
  await assert.rejects(f.service.create(user, 'store-b', { code: 'X', name: 'x', unit: 'kg', reorderPoint: 1 }), /not authorized/);
  await assert.rejects(f.service.list(user, 'store-b', { page: 1, pageSize: 20 }), /not authorized/);
  await assert.rejects(f.service.history(user, 'store-b', { page: 1, pageSize: 20 }), /not authorized/);
  assert.equal(f.calls(), 0);
});

test('inventory item ids cannot escape the requested store', async () => {
  const f = fixture();
  await assert.rejects(f.service.adjust(user, 'store-a', 'foreign-item', request()), /inventory.notFound/);
  assert.equal(f.ledger.length, 0);
});

test('fractional issues use integer thousandths and record actor, reason and before/after', async () => {
  const f = fixture();
  const result = await f.service.adjust(user, 'store-a', 'item-a', request());
  assert.equal(f.item().quantity, 875);
  assert.equal(f.item().version, 1);
  assert.equal(result.quantityBefore, 1);
  assert.equal(result.quantityAfter, 0.875);
  assert.equal(result.actorId, user.userId);
  assert.equal(result.reason, 'Kitchen use');
});

test('same request returns the original movement without a second deduction', async () => {
  const f = fixture();
  const first = await f.service.adjust(user, 'store-a', 'item-a', request());
  const second = await f.service.adjust(user, 'store-a', 'item-a', request());
  assert.deepEqual(first, second);
  assert.equal(f.item().quantity, 875);
  assert.equal(f.ledger.length, 1);
});

test('reusing a request id with another payload or actor is rejected', async () => {
  const f = fixture();
  await f.service.adjust(user, 'store-a', 'item-a', request());
  for (const change of [{ amount: 0.2 }, { reason: 'different' }, { kind: 'COUNT' as const }, { expectedVersion: 1 }]) {
    await assert.rejects(f.service.adjust(user, 'store-a', 'item-a', request(change)), /inventory.requestConflict/);
  }
  await assert.rejects(f.service.adjust({ ...user, userId: 'merchant-b' }, 'store-a', 'item-a', request()), /inventory.requestConflict/);
  assert.equal(f.ledger.length, 1);
});

test('insufficient stock and zero issues never create a ledger entry', async () => {
  const f = fixture();
  await assert.rejects(f.service.adjust(user, 'store-a', 'item-a', request({ amount: 2 })), /inventory.insufficient/);
  await assert.rejects(f.service.adjust(user, 'store-a', 'item-a', request({ amount: 0 })), /inventory.positiveAmount/);
  assert.equal(f.item().quantity, 1000);
  assert.equal(f.ledger.length, 0);
});

test('stocktakes allow a physical count of zero', async () => {
  const f = fixture();
  const result = await f.service.adjust(user, 'store-a', 'item-a', request({ kind: 'COUNT', amount: 0 }));
  assert.equal(result.quantityAfter, 0);
  assert.equal(f.item().quantity, 0);
});

test('threshold changes are versioned and audited without moving stock', async () => {
  const f = fixture();
  const result = await f.service.adjust(user, 'store-a', 'item-a', request({ kind: 'THRESHOLD', amount: 2.125 }));
  assert.equal(result.quantityAfter, result.quantityBefore);
  assert.equal(result.reorderPointBefore, 0.5);
  assert.equal(result.reorderPointAfter, 2.125);
  assert.equal(f.item().reorderPoint, 2125);
  assert.equal(f.item().version, 1);
});

test('stale versions and losing a concurrent compare-and-swap do not write movements', async () => {
  const f = fixture();
  await assert.rejects(f.service.adjust(user, 'store-a', 'item-a', request({ expectedVersion: 1 })), /inventory.stale/);
  f.loseCas();
  await assert.rejects(f.service.adjust(user, 'store-a', 'item-a', request()), /inventory.stale/);
  assert.equal(f.ledger.length, 0);
});

test('concurrent adjustments with the same version allow only one write', async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.service.adjust(user, 'store-a', 'item-a', request()),
    f.service.adjust(user, 'store-a', 'item-a', request({ requestId: 'request-0002' })),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(f.item().quantity, 875);
  assert.equal(f.ledger.length, 1);
});

test('concurrent copies of one request converge on one movement', async () => {
  const f = fixture();
  const results = await Promise.all([
    f.service.adjust(user, 'store-a', 'item-a', request()),
    f.service.adjust(user, 'store-a', 'item-a', request()),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(f.ledger.length, 1);
});

test('receipts cannot overflow the supported stock quantity', async () => {
  const f = fixture();
  await assert.rejects(f.service.adjust(user, 'store-a', 'item-a', request({ kind: 'RECEIVE', amount: 999999 })), /inventory.tooLarge/);
  assert.equal(f.ledger.length, 0);
});
