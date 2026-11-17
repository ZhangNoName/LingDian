import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { StockHoldService } from './stock-hold.service';
import { StockHoldQueryDto } from './dto/stock-hold.dto';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
const user: AuthenticatedUser = { userId: 'merchant-a', sessionId: 's', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ['store-a'] };
function fixture() {
  let current: any = { id: 'order-a', storeId: 'store-a', status: 'PENDING_PAYMENT', stockExpiresAt: new Date(Date.now() - 60000), _count: { inventoryReservations: 1 }, paymentIntents: [{ status: 'PROCESSING', reconciliationStatus: 'MANUAL_REVIEW' }] };
  const calls: any[] = []; let blocked = false, race = false;
  const service = new StockHoldService({
    order: { findFirst: async ({ where }: any) => { calls.push('read'); assert.equal(where.storeId, 'store-a'); return where.id === current.id ? current : null; } },
    authAuditLog: { create: async ({ data }: any) => { calls.push(data); } },
  } as never, new MerchantStoreScope({ resolveStoreIds: (ids: string[]) => ids } as never),
  { recoverExpiredAttempt: async (id: string, store: string) => { calls.push(['payment', id, store]); if (blocked) throw new ConflictException('not proven closed'); } } as never,
  { updateOrderStatus: async (id: string, body: any, scope: any) => {
    calls.push(['terminate', id, body, scope]);
    if (race) { current = { ...current, status: 'PAID', _count: { inventoryReservations: 0 } }; throw new BadRequestException('status changed'); }
    current = { ...current, status: 'TIMED_OUT', _count: { inventoryReservations: 0 } };
  } } as never);
  return { service, calls, current: () => current, update: (patch: any) => { current = { ...current, ...patch }; }, block: () => { blocked = true; }, race: () => { race = true; } };
}
test('hold APIs reject foreign scopes and ids before payment or stock mutation', async () => {
  const f = fixture();
  await assert.rejects(f.service.list(user, 'store-b', new StockHoldQueryDto()), /not authorized/);
  await assert.rejects(f.service.recheck(user, 'store-b', 'order-a'), /not authorized/);
  assert.deepEqual(f.calls, []);
  await assert.rejects(f.service.recheck(user, 'store-a', 'foreign'), /stockHold.notFound/);
  assert.deepEqual(f.calls, ['read']);
});
test('unexpired holds never call the connector or terminate an order', async () => {
  const f = fixture(); f.update({ stockExpiresAt: new Date(Date.now() + 60000) });
  await assert.rejects(f.service.recheck(user, undefined, 'order-a'), /stockHold.notExpired/); assert.deepEqual(f.calls, ['read']);
});
test('uncertain payment keeps ingredients reserved and records the operator outcome', async () => {
  const f = fixture(); f.block(); const result = await f.service.recheck(user, 'store-a', 'order-a');
  assert.equal(result.outcome, 'PAYMENT_BLOCKED'); assert.equal(f.current()._count.inventoryReservations, 1);
  assert.equal(f.calls.some(row => Array.isArray(row) && row[0] === 'terminate'), false);
  const audit = f.calls[f.calls.length - 1]; assert.equal(audit.userId, user.userId); assert.equal(audit.metadata.storeId, 'store-a');
});
test('safe recheck proves payment closure before scoped termination and repeats without another mutation', async () => {
  const f = fixture(); assert.equal((await f.service.recheck(user, 'store-a', 'order-a')).outcome, 'RESOLVED');
  const actions = f.calls.filter(Array.isArray); assert.equal(actions[0][0], 'payment'); assert.equal(actions[1][0], 'terminate');
  assert.equal(actions[1][2].operatorName, user.userId); assert.equal(actions[1][2].status, 'TIMED_OUT'); assert.deepEqual(actions[1][3], { storeIds: ['store-a'] });
  await f.service.recheck(user, 'store-a', 'order-a'); assert.equal(f.calls.filter(Array.isArray).length, 2);
});
test('payment confirmation racing recheck returns actual hold state without forcing a transition', async () => {
  const f = fixture(); f.race(); assert.equal((await f.service.recheck(user, 'store-a', 'order-a')).outcome, 'RESOLVED');
  f.update({ status: 'PAID', _count: { inventoryReservations: 1 } }); assert.equal((await f.service.recheck(user, 'store-a', 'order-a')).outcome, 'RETRY_LATER');
});
test('hold query DTO rejects invalid pages, states and oversized keywords', () => {
  for (const query of [{ page: '0' }, { pageSize: '101' }, { state: 'RELEASE' }, { keyword: 'x'.repeat(65) }]) assert.ok(validateSync(plainToInstance(StockHoldQueryDto, query)).length);
});
