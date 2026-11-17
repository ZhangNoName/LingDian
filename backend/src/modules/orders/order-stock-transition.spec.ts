import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { OrdersService } from './orders.service';

function fixture(activePayment = false) {
  const order = { id: 'o', storeId: 'store-a', orderNo: 'O1', status: 'PENDING_PAYMENT', paymentChannel: 'CASH', isDeleted: false };
  const events: string[] = [];
  const tx = {
    order: { updateMany: async ({ where, data }: any) => { if (where.status !== order.status) return { count: 0 }; order.status = data.status; return { count: 1 }; } },
    paymentIntent: { findFirst: async () => activePayment ? { paymentNo: 'active' } : null },
    orderStatusLog: { create: async () => { events.push('status'); } },
  };
  const prisma = { order: { findFirst: async () => ({ ...order }) }, $transaction: async (fn: (tx: unknown) => unknown) => { const before = { ...order }; try { return await fn(tx); } catch (error) { Object.assign(order, before); throw error; } } };
  const stock = { commit: async () => { events.push('commit'); }, release: async () => { events.push('release'); } };
  const service = new OrdersService(prisma as never, {} as never, {} as never, { scopeWhere: () => ({ storeId: 'store-a' }), getOrderDetail: async () => ({ ...order }) } as never, stock as never);
  return { service, events, order };
}

test('cash payment commits ingredients in the status transaction and repeat confirmation does not deduct twice', async () => {
  const f = fixture();
  await f.service.updateOrderStatus('o', { status: 'PAID' }); await f.service.updateOrderStatus('o', { status: 'PAID' });
  assert.deepEqual(f.events, ['commit', 'status']); assert.equal(f.order.status, 'PAID');
});

test('cancellation releases holds only after confirming there is no active payment', async () => {
  const f = fixture(); await f.service.updateOrderStatus('o', { status: 'CANCELLED' });
  assert.deepEqual(f.events, ['release', 'status']);
  const active = fixture(true);
  await assert.rejects(active.service.updateOrderStatus('o', { status: 'TIMED_OUT' }), /active payment/);
  assert.deepEqual(active.events, []); assert.equal(active.order.status, 'PENDING_PAYMENT');
});
