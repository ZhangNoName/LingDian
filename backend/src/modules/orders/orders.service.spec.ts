import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { OrdersService } from './orders.service';

test('createOrder does not block checkout when sku stock is zero', async () => {
  const createdOrder = {
    id: 'order-1',
    orderNo: 'LD1',
    storeId: 'store-1',
    customerName: '演示用户',
    customerMobile: '13800000000',
    orderType: 'PICKUP',
    status: 'PENDING_PAYMENT',
    paymentChannel: 'CASH',
    totalAmount: 18,
    payableAmount: 18,
    remark: null,
    isDeleted: false,
    deletedAt: null,
    paidAt: null,
    cancelledAt: null,
    refundingAt: null,
    refundedAt: null,
    createdAt: new Date('2026-06-25T00:00:00.000Z'),
    updatedAt: new Date('2026-06-25T00:00:00.000Z'),
    store: { id: 'store-1', name: '零点示范店', code: 'demo' },
    items: [
      {
        id: 'item-1',
        productId: 'product-1',
        skuId: 'sku-1',
        productName: '拿铁',
        skuName: '默认',
        unitPrice: 18,
        quantity: 1,
        subtotal: 18,
        remark: null,
        createdAt: new Date('2026-06-25T00:00:00.000Z'),
        selections: [],
      },
    ],
    statusLogs: [],
  };
  const tx = {
    productSKU: {
      findMany: async () => [
        {
          id: 'sku-1',
          productId: 'product-1',
          skuName: '默认',
          price: 18,
          stockCount: 0,
          isActive: true,
          product: { id: 'product-1', name: '拿铁', status: 'ACTIVE' },
        },
      ],
    },
    selectionOption: {
      findMany: async () => [],
    },
    order: {
      create: async () => createdOrder,
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
  };
  const service = new OrdersService(prisma as never);

  const order = await service.createOrder({
    storeId: 'store-1',
    orderType: 'pickup',
    customerName: '演示用户',
    mobile: '13800000000',
    items: [{ sku_id: 'sku-1', quantity: 1 }],
  });

  assert.equal(order.id, 'order-1');
  assert.equal(order.total_amount, 18);
  assert.equal(order.items[0].sku_id, 'sku-1');
});
