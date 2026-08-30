import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { OrdersService } from './orders.service';
import { OrdersQueryService } from './orders-query.service';

function fakePickupCodeSequence(lastValue = 1) {
  return { upsert: async () => ({ lastValue }) };
}

function fakeStores(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'single',
    primaryStoreId: () => 'store-1',
    resolveRequestedStoreId: (requestedStoreId?: string) => {
      if (requestedStoreId !== undefined && requestedStoreId.trim() !== 'store-1') {
        throw new Error('The requested store does not match the configured store');
      }
      return 'store-1';
    },
    resolveStoreIds: (requestedStoreIds?: readonly string[]) => {
      if (requestedStoreIds !== undefined) {
        const normalized = [...new Set(requestedStoreIds.map((storeId) => storeId.trim()).filter(Boolean))];
        if (normalized.length !== 1 || normalized[0] !== 'store-1') {
          throw new Error('Store access is outside the configured store');
        }
      }
      return ['store-1'];
    },
    resolveCurrentStore: async (client: any) => client.store.findUnique({ where: { id: 'store-1' } }),
    assertReady: async () => undefined,
    ...overrides,
  } as never;
}

function createOrdersService(
  prisma: any,
  addresses: any = {},
  stores: any = fakeStores(),
  integrationOutbox?: any,
) {
  const queries = new OrdersQueryService(prisma, stores);
  return new OrdersService(prisma, addresses, stores, queries, integrationOutbox);
}

test('createOrder does not block checkout when sku stock is zero', async () => {
  const createdOrder = {
    id: 'order-1',
    orderNo: 'LD1',
    storeId: 'store-1',
    orderSource: 'MINIAPP',
    pickupCode: 'U-0001',
    pickupBusinessDate: new Date('2026-06-25T00:00:00.000Z'),
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
    store: { findUnique: async () => ({ status: 'OPEN' }) },
    productSKU: {
      findMany: async () => [
        {
          id: 'sku-1',
          productId: 'product-1',
          skuName: '默认',
          price: 18,
          stockCount: 0,
          isActive: true,
          product: { id: 'product-1', name: '拿铁', status: 'ACTIVE', selectionBindings: [] },
          selectionBindings: [],
        },
      ],
    },
    selectionOption: {
      findMany: async () => [],
    },
    pickupCodeSequence: fakePickupCodeSequence(),
    order: {
      create: async () => createdOrder,
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
  };
  const service = createOrdersService(prisma as never, {} as never, fakeStores());

  const order = await service.createOrder({
    storeId: 'store-1',
    orderType: 'pickup',
    customerName: '演示用户',
    mobile: '13800000000',
    items: [{ sku_id: 'sku-1', quantity: 1 }],
  });

  assert.equal(order.id, 'order-1');
  assert.equal(order.order_source, 'MINIAPP');
  assert.equal(order.pickup_code, 'U-0001');
  assert.equal(order.total_amount, 18);
  assert.equal(order.items[0].sku_id, 'sku-1');
});

test('checkout defaults an omitted store id to the configured primary store', async () => {
  let queriedStoreId: string | undefined;
  let createdStoreId: string | undefined;
  const tx = {
    store: {
      findUnique: async ({ where }: any) => {
        assert.deepEqual(where, { id: 'store-1' });
        return {
          id: 'store-1', status: 'OPEN', dineInEnabled: true, takeoutEnabled: true, pickupEnabled: true,
        };
      },
    },
    productSKU: {
      findMany: async ({ where }: any) => {
        queriedStoreId = where.product.storeId;
        return [{
          id: 'sku-1', productId: 'product-1', skuName: '默认', price: 18, stockCount: 10, isActive: true,
          product: { id: 'product-1', name: '拿铁', status: 'ACTIVE', selectionBindings: [] },
          selectionBindings: [],
        }];
      },
    },
    selectionOption: { findMany: async () => [] },
    pickupCodeSequence: fakePickupCodeSequence(),
    order: {
      create: async ({ data }: any) => {
        createdStoreId = data.storeId;
        return orderRecord(data);
      },
    },
  };
  const service = createOrdersService(
    { $transaction: async (callback: any) => callback(tx) } as never,
    {} as never,
    fakeStores(),
  );

  const order = await service.createOrder({
    orderType: 'pickup', customerName: '顾客', mobile: '13800000000',
    items: [{ sku_id: 'sku-1', quantity: 1 }],
  });

  assert.equal(queriedStoreId, 'store-1');
  assert.equal(createdStoreId, 'store-1');
  assert.equal(order.store_id, 'store-1');
});

test('checkout rejects a store id outside the configured primary store', async () => {
  const service = createOrdersService({
    order: { findFirst: async () => assert.fail('invalid store must fail before querying orders') },
    $transaction: async () => assert.fail('invalid store must fail before transaction'),
  } as never, {} as never, fakeStores());

  await assert.rejects(() => service.createOrder({
    storeId: 'store-2', orderType: 'pickup', customerName: '顾客', mobile: '13800000000',
    items: [{ sku_id: 'sku-1', quantity: 1 }],
  }), /does not match the configured store/i);
});

test('checkout rejects an order type disabled by the primary store', async () => {
  const tx = {
    store: {
      findUnique: async () => ({
        id: 'store-1', status: 'OPEN', dineInEnabled: true, takeoutEnabled: true, pickupEnabled: false,
      }),
    },
    productSKU: { findMany: async () => assert.fail('disabled service must fail before querying SKUs') },
  };
  const service = createOrdersService(
    { $transaction: async (callback: any) => callback(tx) } as never,
    {} as never,
    fakeStores(),
  );

  await assert.rejects(() => service.createOrder({
    orderType: 'pickup', customerName: '顾客', mobile: '13800000000',
    items: [{ sku_id: 'sku-1', quantity: 1 }],
  }), /store is not available/i);
});

test('takeout checkout requires an authenticated owned address', async () => {
  const service = createOrdersService(
    { order: { findFirst: async () => null }, $transaction: async () => assert.fail('missing address must fail before transaction') },
    { findOwnedAddress: async () => assert.fail('missing address id must not be queried') },
    fakeStores(),
  );

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
    store: { findUnique: async () => ({ status: 'OPEN' }) },
    productSKU: {
      findMany: async () => [{
        id: 'sku-1', productId: 'product-1', skuName: '默认', price: 18, stockCount: 0, isActive: true,
        product: { id: 'product-1', name: '拿铁', status: 'ACTIVE', selectionBindings: [] },
        selectionBindings: [],
      }],
    },
    selectionOption: { findMany: async () => [] },
    pickupCodeSequence: fakePickupCodeSequence(),
    authIdentity: {
      findFirst: async () => ({ phoneE164: '+8613900000000' }),
    },
    order: {
      create: async ({ data }: any) => {
        createdData = data;
        return {
          id: 'order-1', orderNo: 'LD1', storeId: 'store-1', customerName: data.customerName,
          orderSource: data.orderSource, pickupCode: data.pickupCode,
          pickupBusinessDate: data.pickupBusinessDate,
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
  const service = createOrdersService(
    { order: { findFirst: async () => null }, $transaction: async (callback: any) => callback(tx) },
    { findOwnedAddress: async (userId: string, addressId: string) => {
      assert.deepEqual([userId, addressId], ['user-1', 'address-1']);
      return address;
    } },
    fakeStores(),
  );

  const order = await service.createOrder({
    storeId: 'store-1', orderType: 'takeout', addressId: 'address-1', items: [{ sku_id: 'sku-1', quantity: 1 }],
  } as any, 'user-1');

  assert.equal(createdData.customerName, '张三');
  assert.equal(createdData.customerMobile, '13800000000');
  assert.equal(createdData.deliveryAddress, '张三 13800000000 北京市北京市西城区太平街甲6号');
  assert.equal(order.delivery_address, createdData.deliveryAddress);
});

test('takeout checkout propagates address ownership rejection', async () => {
  const service = createOrdersService(
    { order: { findFirst: async () => null }, $transaction: async () => assert.fail('unowned address must fail before transaction') },
    { findOwnedAddress: async () => { throw new Error('Address not found.'); } },
    fakeStores(),
  );

  await assert.rejects(
    () => service.createOrder({
      storeId: 'store-1', orderType: 'takeout', addressId: 'address-2', items: [{ sku_id: 'sku-1', quantity: 1 }],
    } as any, 'user-1'),
    /address not found/i,
  );
});

test('checkout accepts duplicate SKU lines and charges selections for every item quantity', async () => {
  let skuQuery: any;
  let createdData: any;
  const group = {
    id: 'group-1', name: '加料', selectionMode: 'MULTIPLE', minSelect: 0,
    maxSelect: 3, isRequired: false, options: [],
  };
  const sku = {
    id: 'sku-1', productId: 'product-1', skuName: '默认', price: 0.1, isActive: true,
    product: { id: 'product-1', name: '拿铁', status: 'ACTIVE', selectionBindings: [{ groupId: group.id, group }] },
    selectionBindings: [],
  };
  const tx = {
    store: { findUnique: async () => ({ status: 'OPEN' }) },
    productSKU: { findMany: async (query: any) => { skuQuery = query; return [sku]; } },
    selectionOption: { findMany: async () => [{
      id: 'option-1', groupId: group.id, name: '椰果', optionType: 'VALUE', priceDelta: 0.2,
      referencedSkuId: null, group, referencedSku: null,
    }] },
    pickupCodeSequence: fakePickupCodeSequence(),
    order: { create: async ({ data }: any) => { createdData = data; return orderRecord(data); } },
  };
  const service = createOrdersService(
    { $transaction: async (callback: any) => callback(tx) } as never,
    {} as never,
    fakeStores(),
  );

  const result = await service.createOrder({
    storeId: 'store-1', orderType: 'pickup', customerName: '顾客', mobile: '13800000000',
    items: [
      { sku_id: 'sku-1', quantity: 2, selections: [{ selectionOptionId: 'option-1', quantity: 1 }] },
      { sku_id: 'sku-1', quantity: 1 },
    ],
  });

  assert.deepEqual(skuQuery.where.id.in, ['sku-1']);
  assert.equal(createdData.items.create[0].subtotal, 0.6);
  assert.equal(createdData.items.create[1].subtotal, 0.1);
  assert.equal(result.payable_amount, 0.7);
});

test('checkout rejects an option that is not bound to the selected SKU', async () => {
  const tx = {
    store: { findUnique: async () => ({ status: 'OPEN' }) },
    productSKU: { findMany: async () => [{
      id: 'sku-1', productId: 'product-1', skuName: '默认', price: 10, isActive: true,
      product: { id: 'product-1', name: '拿铁', status: 'ACTIVE', selectionBindings: [] },
      selectionBindings: [],
    }] },
    selectionOption: { findMany: async () => [{
      id: 'foreign-option', groupId: 'foreign-group', name: '非法折扣', optionType: 'VALUE', priceDelta: -100,
      referencedSkuId: null, group: { id: 'foreign-group', name: '其他商品' }, referencedSku: null,
    }] },
    order: { create: async () => assert.fail('invalid option must not create an order') },
  };
  const service = createOrdersService(
    { $transaction: async (callback: any) => callback(tx) } as never,
    {} as never,
    fakeStores(),
  );

  await assert.rejects(() => service.createOrder({
    storeId: 'store-1', orderType: 'pickup', customerName: '顾客', mobile: '13800000000',
    items: [{ sku_id: 'sku-1', quantity: 1, selections: [{ selectionOptionId: 'foreign-option' }] }],
  }), /not available for this SKU/i);
});

test('customer and merchant order detail queries include their ownership scope', async () => {
  const queries: any[] = [];
  const service = createOrdersService({
    order: { findFirst: async (query: any) => { queries.push(query); return null; } },
  } as never, {} as never, fakeStores());

  await assert.rejects(() => service.getOrderDetail('order-1', { customerUserId: 'user-1' }), /not found/i);
  await assert.rejects(() => service.getOrderDetail('order-2', { storeIds: ['store-1'] }), /not found/i);
  assert.deepEqual(queries[0].where, {
    id: 'order-1', storeId: { in: ['store-1'] }, customerUserId: 'user-1',
  });
  assert.deepEqual(queries[1].where, { id: 'order-2', storeId: { in: ['store-1'] } });
});

test('authenticated checkout reuses an existing order with the same client request id', async () => {
  const existing = orderRecord({
    orderNo: 'LD-existing', storeId: 'store-1', customerName: '顾客', customerMobile: '13800000000',
    orderType: 'PICKUP', status: 'PENDING_PAYMENT', paymentChannel: 'CASH', totalAmount: 18, payableAmount: 18,
    items: { create: [] },
  });
  let transactionCalls = 0;
  const service = createOrdersService({
    order: {
      findFirst: async ({ where }: any) => {
        assert.deepEqual(where, {
          storeId: 'store-1', customerUserId: 'user-1', clientRequestId: 'checkout-request-1',
        });
        return existing;
      },
    },
    $transaction: async () => { transactionCalls += 1; },
  } as never, {} as never, fakeStores());

  const result = await service.createOrder({
    clientRequestId: 'checkout-request-1', storeId: 'store-1', orderType: 'pickup', items: [{ sku_id: 'sku-1', quantity: 1 }],
  }, 'user-1');

  assert.equal(result.order_no, 'LD-existing');
  assert.equal(transactionCalls, 0);
});

test('order list returns a stable pagination contract and applies ownership scope', async () => {
  let listQuery: any;
  let countQuery: any;
  const now = new Date('2026-08-23T00:00:00.000Z');
  const service = createOrdersService({
    order: {
      findMany: async (query: any) => {
        listQuery = query;
        return [{
          id: 'order-1', orderNo: 'LD1', storeId: 'store-1', customerName: '顾客', customerMobile: '13800000000',
          orderSource: 'MINIAPP', pickupCode: 'U-0001', pickupBusinessDate: now,
          deliveryAddress: null, orderType: 'PICKUP', status: 'PAID', paymentChannel: 'CASH', totalAmount: 18,
          payableAmount: 18, remark: null, createdAt: now, updatedAt: now, store: { id: 'store-1', name: '零点店' },
          items: [{ id: 'item-1', productName: '拿铁', skuName: '默认', quantity: 2, subtotal: 18 }],
        }];
      },
      count: async (query: any) => { countQuery = query; return 41; },
    },
  } as never, {} as never, fakeStores());

  const result = await service.getOrders({ page: 2, pageSize: 20 }, { customerUserId: 'user-1' });

  assert.deepEqual(result, { items: [result.items[0]], total: 41, page: 2, page_size: 20 });
  assert.equal(result.items[0].order_source, 'MINIAPP');
  assert.equal(result.items[0].pickup_code, 'U-0001');
  assert.equal(result.items[0].pickup_business_date, '2026-08-23');
  assert.equal(result.items[0].item_count, 2);
  assert.equal(listQuery.skip, 20);
  assert.equal(listQuery.take, 20);
  assert.deepEqual(listQuery.where, countQuery.where);
  assert.deepEqual(listQuery.where.storeId, { in: ['store-1'] });
  assert.equal(listQuery.where.customerUserId, 'user-1');
  assert.equal(listQuery.where.isDeleted, false);
});

test('order keyword search includes the channel pickup code', async () => {
  let listWhere: any;
  const service = createOrdersService({
    order: {
      findMany: async ({ where }: any) => { listWhere = where; return []; },
      count: async () => 0,
    },
  } as never, {} as never, fakeStores());

  await service.getOrders({ keyword: 'MT-00042', page: 1, pageSize: 20 });

  assert.ok(listWhere.OR.some((condition: any) =>
    condition.pickupCode?.contains === 'MT-00042'));
});

test('status update rejects a concurrent payment-channel change and does not write a misleading log', async () => {
  let logWrites = 0;
  let updateWhere: any;
  const persistedPaymentChannel = 'WECHAT';
  const tx = {
    order: {
      updateMany: async ({ where }: any) => {
        updateWhere = where;
        return { count: where.paymentChannel === persistedPaymentChannel ? 1 : 0 };
      },
    },
    orderStatusLog: { create: async () => { logWrites += 1; } },
  };
  const service = createOrdersService({
    order: {
      findFirst: async () => ({
        id: 'order-1', status: 'PENDING_PAYMENT', paymentChannel: 'CASH', isDeleted: false,
      }),
    },
    $transaction: async (callback: any) => callback(tx),
  } as never, {} as never, fakeStores());

  await assert.rejects(
    () => service.updateOrderStatus('order-1', { status: 'PAID' } as any),
    /changed concurrently/i,
  );
  assert.equal(updateWhere.paymentChannel, 'CASH');
  assert.equal(logWrites, 0);
});

test('online orders cannot enter refund states without a verified refund transaction', async () => {
  let transactionCalls = 0;
  const service = createOrdersService({
    order: {
      findFirst: async () => ({
        id: 'order-1', status: 'PAID', paymentChannel: 'WECHAT', isDeleted: false,
      }),
    },
    $transaction: async () => { transactionCalls += 1; },
  } as never, {} as never, fakeStores());

  await assert.rejects(
    () => service.updateOrderStatus('order-1', { status: 'REFUNDING' } as any),
    /verified payment refund transaction/i,
  );
  await assert.rejects(
    () => service.updateOrderStatus('order-1', { status: 'REFUNDED' } as any),
    /verified payment refund transaction/i,
  );
  assert.equal(transactionCalls, 0);
});

test('an order with a reserved payment attempt cannot be cancelled before provider close', async () => {
  let logWrites = 0;
  const tx = {
    order: { updateMany: async () => ({ count: 1 }) },
    paymentIntent: {
      findFirst: async ({ where }: any) => {
        assert.deepEqual(where, {
          orderId: 'order-1',
          status: { in: ['CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED'] },
        });
        return { paymentNo: 'PAY-ACTIVE' };
      },
    },
    orderStatusLog: { create: async () => { logWrites += 1; } },
  };
  const service = createOrdersService({
    order: {
      findFirst: async () => ({
        id: 'order-1', status: 'PENDING_PAYMENT', paymentChannel: 'WECHAT', isDeleted: false,
      }),
    },
    $transaction: async (callback: any) => callback(tx),
  } as never, {} as never, fakeStores());

  await assert.rejects(
    () => service.updateOrderStatus('order-1', { status: 'CANCELLED' } as any),
    /active payment attempt/i,
  );
  assert.equal(logWrites, 0);
});

test('delete condition includes the observed status, active flag, and merchant scope', async () => {
  let updateWhere: any;
  const tx = {
    order: { updateMany: async ({ where }: any) => { updateWhere = where; return { count: 0 }; } },
    orderStatusLog: { create: async () => assert.fail('conflicted delete must not create a log') },
  };
  const service = createOrdersService({
    order: { findFirst: async () => ({ id: 'order-1', status: 'COMPLETED', isDeleted: false }) },
    $transaction: async (callback: any) => callback(tx),
  } as never, {} as never, fakeStores());

  await assert.rejects(() => service.deleteOrder('order-1', 'operator-1', { storeIds: ['store-1'] }), /changed concurrently/i);
  assert.deepEqual(updateWhere, {
    id: 'order-1', status: 'COMPLETED', isDeleted: false, storeId: { in: ['store-1'] },
  });
});

function orderRecord(data: any) {
  const now = new Date('2026-08-23T00:00:00.000Z');
  return {
    id: 'order-1', orderNo: data.orderNo, storeId: data.storeId,
    orderSource: data.orderSource ?? 'MINIAPP', pickupCode: data.pickupCode ?? 'U-0001',
    pickupBusinessDate: data.pickupBusinessDate ?? now,
    customerName: data.customerName, customerMobile: data.customerMobile,
    deliveryAddress: data.deliveryAddress ?? null, orderType: data.orderType,
    status: data.status, paymentChannel: data.paymentChannel,
    totalAmount: data.totalAmount, payableAmount: data.payableAmount, remark: data.remark ?? null,
    isDeleted: false, deletedAt: null, paidAt: null, cancelledAt: null, refundingAt: null, refundedAt: null,
    createdAt: now, updatedAt: now, store: { id: data.storeId, name: '零点示范店', code: 'demo' },
    items: data.items.create.map((item: any, index: number) => ({
      id: `item-${index + 1}`, ...item, createdAt: now,
      selections: item.selections.create.map((selection: any, selectionIndex: number) => ({
        id: `selection-${selectionIndex + 1}`, ...selection, createdAt: now,
      })),
    })),
    statusLogs: [],
  };
}
