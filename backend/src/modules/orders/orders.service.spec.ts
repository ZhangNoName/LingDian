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
    deliveryAddress: null,
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
  const service = new OrdersService(prisma as never, {} as never);

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

test('takeout checkout requires an authenticated owned address', async () => {
  const service = new (OrdersService as any)(
    { $transaction: async () => assert.fail('missing address must fail before transaction') },
    { findOwnedAddress: async () => assert.fail('missing address id must not be queried') },
  ) as OrdersService;

  await assert.rejects(
    () => service.createOrder({
      storeId: 'store-1', orderType: 'takeout', items: [{ sku_id: 'sku-1', quantity: 1 }],
    }, 'user-1'),
    /address is required/i,
  );
});

test('takeout checkout snapshots the owned address and uses its recipient details', async () => {
  let createdData: any;
  const address = {
    id: 'address-1', recipientName: '张三', phoneNumber: '13800000000',
    provinceName: '北京市', cityName: '北京市', countyName: '西城区', streetName: '太平街', detailInfo: '甲6号',
    postalCode: '100000', nationalCode: '110102', isDefault: true,
    createdAt: '2026-08-09T00:00:00.000Z', updatedAt: '2026-08-09T00:00:00.000Z',
  };
  const tx = {
    productSKU: {
      findMany: async () => [{
        id: 'sku-1', productId: 'product-1', skuName: '默认', price: 18, stockCount: 0, isActive: true,
        product: { id: 'product-1', name: '拿铁', status: 'ACTIVE' },
      }],
    },
    selectionOption: { findMany: async () => [] },
    authIdentity: {
      findFirst: async () => ({ phoneE164: '+8613900000000' }),
    },
    order: {
      create: async ({ data }: any) => {
        createdData = data;
        return {
          id: 'order-1', orderNo: 'LD1', storeId: 'store-1', customerName: data.customerName,
          customerMobile: data.customerMobile, deliveryAddress: data.deliveryAddress, orderType: 'TAKEOUT',
          status: 'PENDING_PAYMENT', paymentChannel: 'CASH', totalAmount: 18, payableAmount: 18, remark: null,
          isDeleted: false, deletedAt: null, paidAt: null, cancelledAt: null, refundingAt: null, refundedAt: null,
          createdAt: new Date('2026-08-09T00:00:00.000Z'), updatedAt: new Date('2026-08-09T00:00:00.000Z'),
          store: { id: 'store-1', name: '零点示范店', code: 'demo' },
          items: [{
            id: 'item-1', productId: 'product-1', skuId: 'sku-1', productName: '拿铁', skuName: '默认',
            unitPrice: 18, quantity: 1, subtotal: 18, remark: null, createdAt: new Date('2026-08-09T00:00:00.000Z'), selections: [],
          }],
          statusLogs: [],
        };
      },
    },
  };
  const service = new (OrdersService as any)(
    { $transaction: async (callback: any) => callback(tx) },
    { findOwnedAddress: async (userId: string, addressId: string) => {
      assert.deepEqual([userId, addressId], ['user-1', 'address-1']);
      return address;
    } },
  ) as OrdersService;

  const order = await service.createOrder({
    storeId: 'store-1', orderType: 'takeout', addressId: 'address-1', items: [{ sku_id: 'sku-1', quantity: 1 }],
  } as any, 'user-1');

  assert.equal(createdData.customerName, '张三');
  assert.equal(createdData.customerMobile, '13800000000');
  assert.equal(createdData.deliveryAddress, '张三 13800000000 北京市北京市西城区太平街甲6号');
  assert.equal(order.delivery_address, createdData.deliveryAddress);
});

test('takeout checkout propagates address ownership rejection', async () => {
  const service = new (OrdersService as any)(
    { $transaction: async () => assert.fail('unowned address must fail before transaction') },
    { findOwnedAddress: async () => { throw new Error('Address not found.'); } },
  ) as OrdersService;

  await assert.rejects(
    () => service.createOrder({
      storeId: 'store-1', orderType: 'takeout', addressId: 'address-2', items: [{ sku_id: 'sku-1', quantity: 1 }],
    } as any, 'user-1'),
    /address not found/i,
  );
});
