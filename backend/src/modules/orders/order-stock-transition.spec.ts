import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { OrdersService } from './orders.service';
import type { OrderPickupNotificationService } from './order-pickup-notification.service';

function fixture(activePayment = false, pickup?: OrderPickupNotificationService) {
  const order = { id: 'o', storeId: 'store-a', orderNo: 'O1', status: 'PENDING_PAYMENT', paymentChannel: 'CASH', isDeleted: false };
  const events: string[] = [];
  const tx = {
    order: { updateMany: async ({ where, data }: any) => { if (where.status !== order.status) return { count: 0 }; order.status = data.status; return { count: 1 }; } },
    paymentIntent: { findFirst: async () => activePayment ? { paymentNo: 'active' } : null },
    orderStatusLog: { create: async () => { events.push('status'); } },
  };
  const prisma = { order: { findFirst: async () => ({ ...order }) }, $transaction: async (fn: (tx: unknown) => unknown) => { const before = { ...order }; try { return await fn(tx); } catch (error) { Object.assign(order, before); throw error; } } };
  const stock = { commit: async () => { events.push('commit'); }, release: async () => { events.push('release'); } };
  const service = new OrdersService(prisma as never, {} as never, {} as never, { scopeWhere: () => ({ storeId: 'store-a' }), getOrderDetail: async () => ({ ...order }) } as never, stock as never, undefined, pickup);
  return { service, events, order };
}

test('cash payment commits ingredients in the status transaction and repeat confirmation does not deduct twice', async () => {
  const f = fixture();
  await f.service.updateOrderStatus('o', { status: 'PAID' }); await f.service.updateOrderStatus('o', { status: 'PAID' });
  assert.deepEqual(f.events, ['commit', 'status']); assert.equal(f.order.status, 'PAID');
});

test('a committed READY transition queues pickup notification once', async () => {
  const events: string[] = [];
  const f = fixture(false, {
    enqueueReady: async (tx, id) => {
      assert.equal(id, 'o');
      assert.ok(tx.orderStatusLog);
      events.push('queued');
      return true;
    },
    kick: () => { events.push('scheduled'); },
  } as Pick<OrderPickupNotificationService, 'enqueueReady' | 'kick'> as OrderPickupNotificationService);
  f.order.status = 'PREPARING';
  await f.service.updateOrderStatus('o', { status: 'READY' });
  await f.service.updateOrderStatus('o', { status: 'READY' });
  await f.service.updateOrderStatus('o', { status: 'COMPLETED' });
  assert.deepEqual(events, ['queued', 'scheduled']);
});

test('cancellation releases holds only after confirming there is no active payment', async () => {
  const f = fixture(); await f.service.updateOrderStatus('o', { status: 'CANCELLED' });
  assert.deepEqual(f.events, ['release', 'status']);
  const active = fixture(true);
  await assert.rejects(active.service.updateOrderStatus('o', { status: 'TIMED_OUT' }), /active payment/);
  assert.deepEqual(active.events, []); assert.equal(active.order.status, 'PENDING_PAYMENT');
});

test('a pending payment attempt also blocks manual cash confirmation', async () => {
  const f = fixture(true);
  await assert.rejects(f.service.updateOrderStatus('o', { status: 'PAID' }), /active payment/);
  assert.deepEqual(f.events, []);
  assert.equal(f.order.status, 'PENDING_PAYMENT');
});

test('manual transitions reject a stale confirmed status or payment channel', async () => {
  const f = fixture();
  f.order.status = 'PREPARING';
  await assert.rejects(f.service.updateOrderStatus('o', { status: 'COMPLETED', expectedStatus: 'PAID' }), /changed concurrently/i);
  await assert.rejects(f.service.updateOrderStatus('o', { status: 'COMPLETED', expectedStatus: 'PREPARING', expectedPaymentChannel: 'WECHAT' }), /changed concurrently/i);
  assert.deepEqual(f.events, []);
  assert.equal(f.order.status, 'PREPARING');
  await f.service.updateOrderStatus('o', { status: 'COMPLETED', expectedStatus: 'PREPARING', expectedPaymentChannel: 'CASH' });
  assert.deepEqual(f.events, ['status']);
  assert.equal(f.order.status, 'COMPLETED');
});
