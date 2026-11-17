import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { OrderStockExpiryService } from './order-stock-expiry.service';

test('hold expiry closes recoverable attempts before scoped order termination and retains uncertain payments', async () => {
  const calls: string[] = [];
  const service = new OrderStockExpiryService({ order: { findMany: async ({ where }: any) => {
    assert.equal(where.status, 'PENDING_PAYMENT'); assert.ok(where.stockExpiresAt.lte instanceof Date);
    return [{ id: 'closed', storeId: 'store-b' }, { id: 'unknown', storeId: 'store-b' }];
  } } } as never, { recoverExpiredAttempt: async (id: string) => { calls.push('close:'+id); if (id === 'unknown') throw new Error('provider closure unknown'); } } as never, { updateOrderStatus: async (id: string, body: any, scope: any) => { assert.equal(body.status, 'TIMED_OUT'); assert.deepEqual(scope, { storeIds: ['store-b'] }); calls.push('terminate:'+id); } } as never, { mode: 'multi' } as never);
  await service.flush();
  assert.deepEqual(calls, ['close:closed', 'terminate:closed', 'close:unknown']);
});


test('expiry rotates past uncertain holds and wraps after the last page', async () => {
  const expiresAt = new Date('2026-11-17T00:00:00Z');
  let pass = 0;
  const processed: string[] = [];
  const service = new OrderStockExpiryService({ order: { findMany: async ({ where }: any) => {
    pass++;
    if (pass === 1 || pass === 4) { assert.equal(where.OR, undefined); return [{ id: 'blocked', storeId: 'store-a', stockExpiresAt: expiresAt }]; }
    assert.ok(where.OR);
    if (pass === 2) { assert.equal(where.OR[1].id.gt, 'blocked'); return [{ id: 'later', storeId: 'store-a', stockExpiresAt: expiresAt }]; }
    assert.equal(where.OR[1].id.gt, 'later'); return [];
  } } } as never, { recoverExpiredAttempt: async (id: string) => { if (id === 'blocked') throw new Error('uncertain'); } } as never,
  { updateOrderStatus: async (id: string) => { processed.push(id); } } as never, { mode: 'multi' } as never);
  await service.flush(); await service.flush(); await service.flush(); await service.flush();
  assert.deepEqual(processed, ['later']);
});
