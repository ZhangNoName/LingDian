import { confirmSuccessfulPayment } from './payment-settlement';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PaymentsService } from './payments.service';
import { PaymentExpiryService } from './payment-expiry.service';

function testPaymentsService(prisma: any, gateways: any, stores: any, expiry?: any, stock: any = { commit: async () => undefined }) {
  return new PaymentsService(prisma, gateways, stores, expiry, stock);
}

const storeContext = {
  primaryStoreId: () => 'store-1',
  resolveRequestedStoreId: (storeId?: string) => {
    if (storeId && storeId !== 'store-1') throw new Error('store mismatch');
    return 'store-1';
  },
  resolveStoreIds: (storeIds?: string[]) => {
    if (storeIds && (storeIds.length !== 1 || storeIds[0] !== 'store-1')) throw new Error('store mismatch');
    return ['store-1'];
  },
};

test('an offline customer order cannot create a customer or merchant online payment', async () => {
  const order = {
    id: 'order-1', storeId: 'store-1', status: 'PENDING_PAYMENT', orderSource: 'MINIAPP',
    paymentChannel: 'CASH', payableAmount: 18.8, paymentIntents: [],
  };
  const prisma = {
    order: { findFirst: async () => order },
    paymentIntent: { findUnique: async () => null },
    paymentAccount: { findUnique: async () => assert.fail('offline checkout must not look up a gateway account') },
  };
  const service = testPaymentsService(prisma, {}, storeContext);
  assert.deepEqual(await service.getCustomerPaymentMethods('store-1'), { wechatMiniProgram: false });
  await assert.rejects(service.createIntent(order.id, 'owner', {
    provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'offline',
  }), /仅支持线下支付/);
  assert.equal((await service.createMerchantWechatNativePayment(order.id, ['store-1'])).state, 'UNAVAILABLE');
  order.orderSource = 'APP';
  await assert.rejects(service.createIntent(order.id, 'owner', {
    provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'offline-app',
  }), /App 订单仅支持线下支付/);
  assert.equal((await service.createMerchantWechatNativePayment(order.id, ['store-1'])).state, 'UNAVAILABLE');
});

test('only the owner of a pending WeChat order can resume its active payment', async () => {
  const expected = { id: 'order-1', storeId: 'store-1', status: 'PENDING_PAYMENT', paymentChannel: 'WECHAT' };
  const active = {
    paymentNo: 'PAY1', orderId: expected.id, provider: 'WECHAT_PAY', channel: 'WECHAT', status: 'PENDING',
    amountMinor: 1550n, currency: 'CNY', clientAction: { type: 'WECHAT_MINI_PROGRAM' },
    expiresAt: new Date(Date.now() + 60_000), paidAt: null, order: { status: 'PENDING_PAYMENT' },
  };
  const prisma = {
    order: { findFirst: async ({ where }: any) => {
      assert.equal(where.storeId, 'store-1');
      assert.equal(where.isDeleted, false);
      return where.customerUserId === 'owner' ? expected : null;
    } },
    paymentIntent: { findFirst: async ({ where }: any) => {
      assert.equal(where.activeOrderKey, expected.id);
      assert.equal(where.orderId, expected.id);
      return active;
    } },
  };
  const service = testPaymentsService(prisma, {}, storeContext);
  await assert.rejects(service.getActiveWechatPayment(expected.id, 'another-user'), /Order not found/);
  assert.equal((await service.getActiveWechatPayment(expected.id, 'owner')).intent?.payment_no, 'PAY1');
  expected.status = 'PAID';
  assert.deepEqual(await service.getActiveWechatPayment(expected.id, 'owner'), { intent: null });
});

test('customer recheck closes an expired active attempt only after a connector proof', async () => {
  const intent = {
    paymentNo: 'PAY1', orderId: 'order-1', activeOrderKey: 'order-1', provider: 'WECHAT_PAY', channel: 'WECHAT',
    status: 'PENDING', amountMinor: 1550n, currency: 'CNY', clientAction: null,
    expiresAt: new Date(Date.now() + 60_000), paidAt: null, order: { status: 'PENDING_PAYMENT', storeId: 'store-1' },
  };
  const prisma = {
    paymentIntent: { findFirst: async ({ where }: any) => {
      assert.equal(where.paymentNo, intent.paymentNo);
      assert.equal(where.order.storeId, 'store-1');
      return where.order.customerUserId === 'owner' ? intent : null;
    } },
  };
  let closes = 0;
  const expiry = {
    isExpiredActiveIntent: (candidate: typeof intent) => candidate.expiresAt < new Date(),
    recoverExpiredAttempt: async (orderId: string, storeId: string) => {
      assert.deepEqual([orderId, storeId], ['order-1', 'store-1']);
      if (++closes === 1) throw new Error('Connector closure not proven');
      intent.status = 'EXPIRED';
    },
  };
  const service = testPaymentsService(prisma, {}, storeContext, expiry);
  assert.equal((await service.recheckCustomerIntent('PAY1', 'owner')).status, 'PENDING');
  intent.expiresAt = new Date(0);
  await assert.rejects(service.recheckCustomerIntent('PAY1', 'another-user'), /Payment not found/);
  assert.equal(closes, 0);
  await assert.rejects(service.recheckCustomerIntent('PAY1', 'owner'), /not proven/);
  assert.equal(intent.status, 'PENDING');
  assert.equal((await service.recheckCustomerIntent('PAY1', 'owner')).status, 'EXPIRED');
});

for (const callbackStatus of [undefined, 'SUCCEEDED', 'FAILED', 'PROCESSING'] as const) {
  test(`createIntent preserves payment state when the connector returns after ${callbackStatus ?? 'no callback'}`, async () => {
    let gatewayInput: any;
    const now = new Date(Date.now() + 60_000);
    const account = { id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT', externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE' };
    const created = { id: 'intent-1', paymentNo: 'PAY1', orderId: 'order-1', accountId: account.id, provider: 'WECHAT_PAY', channel: 'WECHAT', status: 'CREATED', reconciliationStatus: 'PENDING', amountMinor: 1880n, currency: 'CNY', clientRequestId: 'request-1', providerIntentId: null, clientAction: null, expiresAt: now, paidAt: null };
    let current: any;
    const prisma = {
      paymentIntent: {
        findUnique: async () => null,
        findFirst: async () => null,
        create: async ({ data }: any) => {
          current = { ...data, ...created };
          return { ...current };
        },
        findUniqueOrThrow: async () => ({ ...current, order: { status: 'PENDING_PAYMENT' } }),
        updateMany: async ({ where, data }: any) => {
          if (where.status !== current.status || where.activeOrderKey !== current.activeOrderKey) return { count: 0 };
          Object.assign(current, data);
          return { count: 1 };
        },
      },
      order: { findFirst: async () => ({ id: 'order-1', orderNo: 'LD1', storeId: 'store-1', status: 'PENDING_PAYMENT', paymentChannel: 'CASH', payableAmount: 18.8 }), updateMany: async () => ({ count: 1 }) },
      paymentAccount: { findUnique: async ({ where }: any) => {
        assert.deepEqual(where.storeId_provider_channel, { storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT' });
        return account;
      } },
    };
    (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma);
    const gateways = { create: () => ({ createIntent: async (input: any) => {
      gatewayInput = input;
      if (callbackStatus) Object.assign(current, {
        status: callbackStatus,
        activeOrderKey: callbackStatus === 'PROCESSING' ? current.orderId : null,
        providerIntentId: 'wx-1',
      });
      return { providerIntentId: 'wx-1', status: callbackStatus ? 'PENDING' : 'SUCCEEDED', accountExternalId: 'mch-1', amountMinor: 1880, currency: 'CNY', clientAction: { token: 'client-only' } };
    } }) };
    const service = testPaymentsService(prisma as never, gateways as never, storeContext as never);
    const result = await service.createIntent('order-1', 'user-1', { provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'request-1' });
    assert.equal(gatewayInput.amountMinor, 1880);
    assert.equal(result.amount_minor, 1880);
    assert.equal(result.payment_no, 'PAY1');
    assert.equal(result.status, callbackStatus ?? 'PROCESSING');
    assert.deepEqual(result.client_action, result.status === 'PROCESSING' ? { token: 'client-only' } : null);
    assert.equal(current.activeOrderKey, ['SUCCEEDED', 'FAILED'].includes(current.status) ? null : current.orderId);
  });
}

test('createIntent rejects a connector response that redirects funds to another recipient', async () => {
  const account = { id: 'account-1', storeId: 'store-1', provider: 'ALIPAY', channel: 'ALIPAY', externalAccountId: 'merchant-correct', connectorConfigKey: 'STORE_1', status: 'ACTIVE' };
  const intent = { id: 'intent-1', paymentNo: 'PAY1', activeOrderKey: 'order-1', orderId: 'order-1', accountId: account.id, provider: 'ALIPAY', channel: 'ALIPAY', status: 'CREATED', amountMinor: 100n, currency: 'CNY', clientRequestId: 'request-1', clientAction: null, expiresAt: new Date(), paidAt: null };
  let failedData: Record<string, unknown> | undefined;
  const prisma = {
    paymentIntent: { findUnique: async () => null, findFirst: async () => null, create: async () => intent, update: async ({ data }: any) => { failedData = data; return { ...intent, ...data }; }, updateMany: async () => ({ count: 0 }) },
    order: { findFirst: async () => ({ id: 'order-1', orderNo: 'LD1', storeId: 'store-1', status: 'PENDING_PAYMENT', paymentChannel: 'CASH', payableAmount: 1 }), updateMany: async () => ({ count: 1 }) },
    paymentAccount: { findUnique: async () => account },
  };
  (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma);
  const gateways = { create: () => ({ createIntent: async () => ({ providerIntentId: 'ali-1', status: 'PENDING', accountExternalId: 'attacker', amountMinor: 100, currency: 'CNY', clientAction: null }) }) };
  const service = testPaymentsService(prisma as never, gateways as never, storeContext as never);
  await assert.rejects(() => service.createIntent('order-1', 'user-1', { provider: 'ALIPAY', channel: 'ALIPAY', clientRequestId: 'request-1' }), /mismatched recipient/i);
  assert.equal(failedData?.activeOrderKey, undefined);
  assert.equal(failedData?.status, undefined);
  assert.equal(failedData?.reconciliationStatus, 'MANUAL_REVIEW');
});

test('an unknown connector create outcome keeps the attempt active until verified closure', async () => {
  const account = {
    id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT',
    externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE',
  };
  const intent: any = {
    id: 'intent-1', paymentNo: 'PAY-CREATE-UNKNOWN', activeOrderKey: 'order-1',
    orderId: 'order-1', accountId: account.id, provider: 'WECHAT_PAY', channel: 'WECHAT',
    status: 'CREATED', reconciliationStatus: 'PENDING', amountMinor: 1880n, currency: 'CNY',
    clientRequestId: 'request-unknown', providerIntentId: null, clientAction: null,
    expiresAt: new Date(Date.now() + 60_000), paidAt: null,
  };
  let failureData: any;
  const prisma = {
    order: {
      findFirst: async () => ({
        id: 'order-1', orderNo: 'LD1', storeId: 'store-1', status: 'PENDING_PAYMENT',
        paymentChannel: 'CASH', payableAmount: 18.8,
      }),
      updateMany: async () => ({ count: 1 }),
    },
    paymentAccount: { findUnique: async () => account },
    paymentIntent: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => intent,
      updateMany: async ({ data }: any) => { failureData = data; return { count: 1 }; },
    },
  };
  (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma);
  const service = testPaymentsService(prisma as never, {
    create: () => ({
      createIntent: async () => { throw new Error('response lost after dispatch'); },
    }),
  } as never, storeContext as never);

  await assert.rejects(
    () => service.createIntent('order-1', 'user-1', {
      provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'request-unknown',
    }),
    /response lost/,
  );

  assert.equal(failureData.status, undefined);
  assert.equal(failureData.activeOrderKey, undefined);
  assert.equal(failureData.reconciliationStatus, 'MANUAL_REVIEW');
  assert.equal(failureData.failureCode, 'CONNECTOR_OUTCOME_UNKNOWN');
});

test('idempotency lookup never discloses an intent before order ownership and store scope are verified', async () => {
  let intentLookup = false;
  const service = testPaymentsService({
    order: { findFirst: async () => null },
    paymentIntent: { findUnique: async () => { intentLookup = true; return null; } },
  } as never, {} as never, storeContext as never);

  await assert.rejects(
    () => service.createIntent('foreign-order', 'user-1', {
      provider: 'WECHAT_PAY',
      channel: 'WECHAT',
      clientRequestId: 'request-foreign',
    }),
    /Order not found/,
  );
  assert.equal(intentLookup, false);
});

test('an authorized retry returns its existing payment intent without creating another provider attempt', async () => {
  const existing = {
    order: { status: 'PENDING_PAYMENT' },
    id: 'intent-existing',
    paymentNo: 'PAY-EXISTING',
    orderId: 'order-1',
    accountId: 'account-1',
    provider: 'WECHAT_PAY',
    channel: 'WECHAT',
    status: 'PENDING',
    reconciliationStatus: 'PENDING',
    amountMinor: 1880n,
    currency: 'CNY',
    clientRequestId: 'request-1',
    providerIntentId: 'wx-existing',
    clientAction: { token: 'existing' },
    expiresAt: new Date('2099-08-29T10:15:00Z'),
    paidAt: null,
  };
  let authorizedWhere: unknown;
  const service = testPaymentsService({
    order: {
      findFirst: async ({ where }: any) => {
        authorizedWhere = where;
        return {
          id: 'order-1',
          orderNo: 'LD1',
          storeId: 'store-1',
          status: 'PENDING_PAYMENT',
          paymentChannel: 'CASH',
          payableAmount: 18.8,
        };
      },
    },
    paymentIntent: { findUnique: async () => existing },
  } as never, {
    create: () => { throw new Error('gateway must not be called for an idempotent retry'); },
  } as never, storeContext as never);

  const result = await service.createIntent('order-1', 'user-1', {
    provider: 'WECHAT_PAY',
    channel: 'WECHAT',
    clientRequestId: 'request-1',
  });

  assert.deepEqual(authorizedWhere, {
    id: 'order-1',
    customerUserId: 'user-1',
    storeId: 'store-1',
    isDeleted: false,
  });
  assert.equal(result.payment_no, 'PAY-EXISTING');
});

test('a unique-create race recovers the authorized duplicate without calling the provider twice', async () => {
  const duplicate = {
    order: { status: 'PENDING_PAYMENT' },
    id: 'intent-race-winner',
    paymentNo: 'PAY-RACE-WINNER',
    orderId: 'order-1',
    accountId: 'account-1',
    provider: 'WECHAT_PAY',
    channel: 'WECHAT',
    status: 'CREATED',
    reconciliationStatus: 'PENDING',
    amountMinor: 1880n,
    currency: 'CNY',
    clientRequestId: 'request-1',
    providerIntentId: null,
    clientAction: null,
    expiresAt: new Date('2026-08-29T10:15:00Z'),
    paidAt: null,
  };
  let duplicateLookups = 0;
  let gatewayCalls = 0;
  const prisma = {
    order: {
      findFirst: async () => ({
        id: 'order-1', orderNo: 'LD1', storeId: 'store-1', status: 'PENDING_PAYMENT',
        paymentChannel: 'CASH', payableAmount: 18.8,
      }),
      updateMany: async () => ({ count: 1 }),
    },
    paymentAccount: {
      findUnique: async () => ({
        id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT',
        externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE',
      }),
    },
    paymentIntent: {
      findUnique: async () => {
        duplicateLookups += 1;
        return duplicateLookups <= 2 ? null : duplicate;
      },
      findFirst: async () => null,
      create: async () => { throw { code: 'P2002' }; },
    },
  };
  (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma);
  const service = testPaymentsService(prisma as never, {
    create: () => ({
      createIntent: async () => {
        gatewayCalls += 1;
        throw new Error('gateway must not be called by the losing request');
      },
    }),
  } as never, storeContext as never);

  const result = await service.createIntent('order-1', 'user-1', {
    provider: 'WECHAT_PAY',
    channel: 'WECHAT',
    clientRequestId: 'request-1',
  });

  assert.equal(duplicateLookups, 3);
  assert.equal(gatewayCalls, 0);
  assert.equal(result.payment_no, 'PAY-RACE-WINNER');
});

test('createIntent stops when cancellation wins before the reservation transaction', async () => {
  let intentCreates = 0;
  let gatewayCalls = 0;
  let persistedStatus = 'PENDING_PAYMENT';
  const prisma = {
    order: {
      findFirst: async () => {
        const observed = {
          id: 'order-1', orderNo: 'LD1', storeId: 'store-1', status: persistedStatus,
          paymentChannel: 'CASH', payableAmount: 18.8,
        };
        persistedStatus = 'CANCELLED';
        return observed;
      },
      updateMany: async ({ where }: any) => ({
        count: persistedStatus === where.status ? 1 : 0,
      }),
    },
    paymentAccount: {
      findUnique: async () => ({
        id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT',
        externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE',
      }),
    },
    paymentIntent: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => { intentCreates += 1; },
    },
  };
  (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma);
  const service = testPaymentsService(prisma as never, {
    create: () => ({ createIntent: async () => { gatewayCalls += 1; } }),
  } as never, storeContext as never);

  await assert.rejects(
    () => service.createIntent('order-1', 'user-1', {
      provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'request-cancelled',
    }),
    /no longer awaiting payment/i,
  );
  assert.equal(intentCreates, 0);
  assert.equal(gatewayCalls, 0);
});

test('different idempotency keys cannot concurrently create two active payment attempts', async () => {
  const order = {
    id: 'order-1', orderNo: 'LD1', storeId: 'store-1', status: 'PENDING_PAYMENT',
    paymentChannel: 'CASH', payableAmount: 18.8,
  };
  const account = {
    id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT',
    externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE',
  };
  const intents: any[] = [];
  let gatewayCalls = 0;
  const prisma = {
    order: {
      findFirst: async () => order,
      updateMany: async () => ({ count: order.status === 'PENDING_PAYMENT' ? 1 : 0 }),
    },
    paymentAccount: { findUnique: async () => account },
    paymentIntent: {
      findUniqueOrThrow: async ({ where }: any) => ({ ...intents.find((row) => row.id === where.id), order }),
      findUnique: async ({ where }: any) => {
        const key = where.orderId_clientRequestId;
        return key
          ? intents.find((intent) => intent.orderId === key.orderId && intent.clientRequestId === key.clientRequestId) ?? null
          : null;
      },
      findFirst: async () => intents.find((intent) => ['CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED'].includes(intent.status)) ?? null,
      create: async ({ data }: any) => {
        const intent = {
          id: `intent-${intents.length + 1}`,
          status: 'CREATED',
          reconciliationStatus: 'PENDING',
          providerIntentId: null,
          clientAction: null,
          paidAt: null,
          ...data,
        };
        intents.push(intent);
        return intent;
      },
      updateMany: async ({ where, data }: any) => {
        const row = intents.find((candidate) => candidate.id === where.id && candidate.status === where.status);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  };
  let transactionTail = Promise.resolve();
  (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => {
    const previous = transactionTail;
    let release!: () => void;
    transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation(prisma);
    } finally {
      release();
    }
  };
  const service = testPaymentsService(prisma as never, {
    create: () => ({
      createIntent: async ({ paymentNo }: { paymentNo: string }) => {
        gatewayCalls += 1;
        return {
          providerIntentId: `provider-${paymentNo}`,
          status: 'PENDING',
          accountExternalId: account.externalAccountId,
          amountMinor: 1880,
          currency: 'CNY',
          clientAction: null,
        };
      },
    }),
  } as never, storeContext as never);

  const results = await Promise.allSettled([
    service.createIntent(order.id, 'user-1', {
      provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'request-concurrent-a',
    }),
    service.createIntent(order.id, 'user-1', {
      provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'request-concurrent-b',
    }),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(intents.length, 1);
  assert.equal(gatewayCalls, 1);
});

test('an expired attempt with no provider id is replaced only after durable connector closure', async () => {
  const order = {
    id: 'order-1', orderNo: 'LD1', storeId: 'store-1', status: 'PENDING_PAYMENT',
    paymentChannel: 'WECHAT', payableAmount: 18.8,
  };
  const account = {
    id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT',
    externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE',
  };
  const oldIntent: any = {
    id: 'intent-old', paymentNo: 'PAY-OLD', activeOrderKey: order.id, orderId: order.id,
    accountId: account.id, provider: 'WECHAT_PAY', channel: 'WECHAT', status: 'CREATED',
    reconciliationStatus: 'MANUAL_REVIEW', amountMinor: 1880n, currency: 'CNY',
    clientRequestId: 'request-old', providerIntentId: null, clientAction: null,
    expiresAt: new Date(Date.now() - 60_000), paidAt: null, createdAt: new Date(0),
  };
  const intents: any[] = [oldIntent];
  let closeInput: any;
  let providerCreates = 0;
  const prisma = {
    order: {
      findFirst: async () => order,
      updateMany: async () => ({ count: 1 }),
    },
    paymentAccount: { findUnique: async () => account },
    paymentIntent: {
      findUniqueOrThrow: async ({ where }: any) => ({ ...intents.find((row) => row.id === where.id), order }),
      findUnique: async ({ where }: any) => {
        if (where.id) return intents.find((intent) => intent.id === where.id) ?? null;
        const key = where.orderId_clientRequestId;
        return key
          ? intents.find((intent) => intent.orderId === key.orderId && intent.clientRequestId === key.clientRequestId) ?? null
          : null;
      },
      findFirst: async ({ where }: any) => {
        const active = intents.find((intent) =>
          intent.orderId === where.orderId &&
          ['CREATED', 'PENDING', 'PROCESSING'].includes(intent.status) &&
          intent.activeOrderKey === where.orderId);
        return where.expiresAt && active ? { ...active, account } : active ?? null;
      },
      create: async ({ data }: any) => {
        const intent = {
          id: 'intent-new', status: 'CREATED', reconciliationStatus: 'PENDING',
          providerIntentId: null, clientAction: null, paidAt: null, ...data,
        };
        intents.push(intent);
        return intent;
      },
      update: async ({ where, data }: any) => {
        const intent = intents.find((candidate) => candidate.id === where.id);
        Object.assign(intent, data);
        return intent;
      },
      updateMany: async ({ where, data }: any) => {
        const intent = intents.find((candidate) => candidate.id === where.id);
        if (!intent) return { count: 0 };
        Object.assign(intent, data);
        return { count: 1 };
      },
    },
  };
  (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma);
  const service = testPaymentsService(prisma as never, {
    create: () => ({
      closeIntent: async (input: any) => {
        closeInput = input;
        return {
          paymentNo: oldIntent.paymentNo, providerIntentId: null,
          accountExternalId: account.externalAccountId, status: 'CLOSED', closureId: 'close-old',
        };
      },
      createIntent: async () => {
        providerCreates += 1;
        return {
          providerIntentId: 'provider-new', status: 'PENDING',
          accountExternalId: account.externalAccountId, amountMinor: 1880,
          currency: 'CNY', clientAction: null,
        };
      },
    }),
  } as never, storeContext as never);

  const result = await service.createIntent(order.id, 'user-1', {
    provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'request-new',
  });

  assert.deepEqual(closeInput, {
    paymentNo: 'PAY-OLD', providerIntentId: null, reason: 'EXPIRED',
  });
  assert.equal(oldIntent.status, 'EXPIRED');
  assert.equal(oldIntent.activeOrderKey, null);
  assert.equal(oldIntent.failureCode, 'PROVIDER_CONFIRMED_CLOSED');
  assert.equal(providerCreates, 1);
  assert.equal(result.status, 'PENDING');
  assert.equal(result.payment_no, (intents.find((intent) => intent.id === 'intent-new')).paymentNo);
});

test('an expired attempt remains blocked when connector closure is unknown', async () => {
  const account = {
    id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT',
    externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE',
  };
  const oldIntent: any = {
    id: 'intent-old', paymentNo: 'PAY-OLD', activeOrderKey: 'order-1', orderId: 'order-1',
    accountId: account.id, provider: 'WECHAT_PAY', channel: 'WECHAT', status: 'PROCESSING',
    reconciliationStatus: 'PENDING', amountMinor: 1880n, currency: 'CNY',
    clientRequestId: 'request-old', providerIntentId: 'provider-old', clientAction: null,
    expiresAt: new Date(Date.now() - 60_000), paidAt: null, createdAt: new Date(0), account,
  };
  let providerCreates = 0;
  const prisma = {
    order: {
      findFirst: async () => ({
        id: 'order-1', orderNo: 'LD1', storeId: 'store-1', status: 'PENDING_PAYMENT',
        paymentChannel: 'WECHAT', payableAmount: 18.8,
      }),
    },
    paymentIntent: {
      findUnique: async () => null,
      findFirst: async () => oldIntent,
      updateMany: async ({ data }: any) => { Object.assign(oldIntent, data); return { count: 1 }; },
    },
  };
  const service = testPaymentsService(prisma as never, {
    create: () => ({
      closeIntent: async () => ({
        paymentNo: oldIntent.paymentNo, providerIntentId: oldIntent.providerIntentId,
        accountExternalId: account.externalAccountId, status: 'UNKNOWN', closureId: null,
      }),
      createIntent: async () => { providerCreates += 1; },
    }),
  } as never, storeContext as never);

  await assert.rejects(
    () => service.createIntent('order-1', 'user-1', {
      provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'request-new',
    }),
    /not proven closed/i,
  );

  assert.equal(oldIntent.status, 'PROCESSING');
  assert.equal(oldIntent.activeOrderKey, 'order-1');
  assert.equal(oldIntent.reconciliationStatus, 'MANUAL_REVIEW');
  assert.equal(oldIntent.failureCode, 'EXPIRED_CLOSE_UNKNOWN');
  assert.equal(providerCreates, 0);
});

test('provider success observed during close wins and cannot be overwritten by local expiry', async () => {
  const account = {
    provider: 'WECHAT_PAY', externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1',
  };
  const candidate: any = {
    id: 'intent-1', orderId: 'order-1', paymentNo: 'PAY1', providerIntentId: 'provider-1',
    channel: 'WECHAT', status: 'PROCESSING', activeOrderKey: 'order-1',
    expiresAt: new Date(Date.now() - 60_000), account,
  };
  const current = { ...candidate, status: 'SUCCEEDED', activeOrderKey: null };
  let expiryWrites = 0;
  const prisma = {
    order: { updateMany: async () => ({ count: 1 }) },
    paymentIntent: {
      findUnique: async () => current,
      updateMany: async () => { expiryWrites += 1; return { count: 1 }; },
    },
  };
  (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma);
  const expiry = new PaymentExpiryService(prisma as never, {} as never);

  const released = await expiry.releaseProviderClosedIntent(candidate, 'store-1', {
    paymentNo: candidate.paymentNo,
    providerIntentId: candidate.providerIntentId,
    accountExternalId: account.externalAccountId,
    status: 'CLOSED',
    closureId: 'close-raced',
  });

  assert.equal(released, false);
  assert.equal(current.status, 'SUCCEEDED');
  assert.equal(current.activeOrderKey, null);
  assert.equal(expiryWrites, 0);
});

test('a verified success webhook repairs a previously succeeded intent whose order is still pending', async () => {
  const order = { id: 'order-1', status: 'PENDING_PAYMENT', storeId: 'store-1' };
  const intent: any = {
    id: 'intent-1', paymentNo: 'PAY1', orderId: order.id, accountId: 'account-1',
    provider: 'WECHAT_PAY', channel: 'WECHAT', status: 'SUCCEEDED', activeOrderKey: null,
    reconciliationStatus: 'PENDING', amountMinor: 1880n, currency: 'CNY',
    clientRequestId: 'request-1', providerIntentId: 'provider-1', clientAction: null,
    expiresAt: new Date('2026-08-30T10:15:00Z'), paidAt: null, order,
  };
  let stockCommits = 0;
  let transactionWritten = false;
  let statusLogWritten = false;
  let eventProcessed = false;
  const account = {
    id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT',
    externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE',
  };
  const payload = {
    event_id: 'event-1', event_type: 'PAYMENT_SUCCEEDED' as const, payment_no: intent.paymentNo,
    provider_intent_id: intent.providerIntentId, provider_transaction_id: 'provider-txn-1',
    account_external_id: account.externalAccountId, amount_minor: 1880, currency: 'CNY',
    occurred_at: '2026-08-30T10:00:00.000Z',
  };
  const prisma = {
    paymentAccount: { findFirst: async () => account },
    paymentWebhookEvent: {
      create: async () => ({}),
      findUnique: async () => null,
      update: async () => { eventProcessed = true; },
    },
    paymentIntent: {
      findUnique: async () => intent,
      update: async ({ data }: any) => { Object.assign(intent, data); return intent; },
      updateMany: async () => ({ count: 0 }),
    },
    paymentTransaction: {
      findFirst: async () => null,
      upsert: async () => {
        transactionWritten = true;
        return {
          paymentIntentId: intent.id, type: 'PAYMENT', status: 'SUCCEEDED',
          amountMinor: intent.amountMinor, currency: intent.currency,
        };
      },
    },
    order: {
      updateMany: async () => {
        if (order.status !== 'PENDING_PAYMENT') return { count: 0 };
        order.status = 'PAID';
        return { count: 1 };
      },
    },
    orderStatusLog: { create: async () => { statusLogWritten = true; return {}; } },
  };
  (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma);
  const service = testPaymentsService(prisma as never, {
    create: () => ({ verifyWebhook: () => payload }),
  } as never, storeContext as never, undefined, { commit: async () => { stockCommits++; } });

  const result = await service.handleWebhook('WECHAT_PAY', account.id, Buffer.from(JSON.stringify(payload)), {});

  assert.deepEqual(result, { accepted: true, duplicate: false });
  assert.equal(order.status, 'PAID');
  assert.equal(stockCommits, 1);
  assert.equal(intent.reconciliationStatus, 'MATCHED');
  assert.equal(transactionWritten, true);
  assert.equal(statusLogWritten, true);
  assert.equal(eventProcessed, true);
});

test('a late success webhook overrides local expiry and records cancelled order payment for review', async () => {
  const order = { id: 'order-1', status: 'PENDING_PAYMENT', storeId: 'store-1' };
  const intent: any = {
    id: 'intent-1', paymentNo: 'PAY1', orderId: order.id, accountId: 'account-1',
    provider: 'WECHAT_PAY', channel: 'WECHAT', status: 'EXPIRED', activeOrderKey: null,
    reconciliationStatus: 'PENDING', amountMinor: 1880n, currency: 'CNY',
    clientRequestId: 'request-1', providerIntentId: null, clientAction: null,
    expiresAt: new Date('2026-08-30T10:15:00Z'), paidAt: null, order,
  };
  const account = {
    id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT',
    externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE',
  };
  const payload = {
    event_id: 'event-cancel-race', event_type: 'PAYMENT_SUCCEEDED' as const,
    payment_no: intent.paymentNo, provider_intent_id: 'provider-late',
    provider_transaction_id: 'provider-txn-cancel-race',
    account_external_id: account.externalAccountId, amount_minor: 1880, currency: 'CNY',
    occurred_at: '2026-08-30T10:00:00.000Z',
  };
  let transactionWritten = false;
  let statusLogWritten = false;
  const prisma = {
    paymentAccount: { findFirst: async () => account },
    paymentWebhookEvent: {
      create: async () => ({}),
      findUnique: async () => null,
      update: async () => ({}),
    },
    paymentIntent: {
      findUnique: async () => intent,
      update: async ({ data }: any) => { Object.assign(intent, data); return intent; },
    },
    paymentTransaction: {
      findFirst: async () => null,
      upsert: async () => {
        transactionWritten = true;
        return {
          paymentIntentId: intent.id, type: 'PAYMENT', status: 'SUCCEEDED',
          amountMinor: intent.amountMinor, currency: intent.currency,
        };
      },
    },
    order: {
      updateMany: async () => {
        order.status = 'CANCELLED';
        return { count: 0 };
      },
      findUnique: async () => order,
    },
    orderStatusLog: { create: async () => { statusLogWritten = true; return {}; } },
  };
  (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma);
  const service = testPaymentsService(prisma as never, {
    create: () => ({ verifyWebhook: () => payload }),
  } as never, storeContext as never);

  await service.handleWebhook(
    'WECHAT_PAY', account.id, Buffer.from(JSON.stringify(payload)), {},
  );

  assert.equal(order.status, 'CANCELLED');
  assert.equal(intent.status, 'SUCCEEDED');
  assert.equal(intent.providerIntentId, 'provider-late');
  assert.equal(intent.reconciliationStatus, 'LATE_PAYMENT');
  assert.equal(transactionWritten, true);
  assert.equal(statusLogWritten, false);
});

test('a success fact remains matched when the order is already in a paid terminal path', async () => {
  const order = { id: 'order-1', status: 'COMPLETED', storeId: 'store-1' };
  const intent: any = {
    id: 'intent-1', paymentNo: 'PAY1', orderId: order.id, accountId: 'account-1', status: 'SUCCEEDED',
    providerIntentId: 'provider-1', reconciliationStatus: 'MATCHED',
    amountMinor: 1880n, currency: 'CNY', paidAt: new Date('2026-08-30T09:59:00.000Z'),
    order,
  };
  let transactionWritten = false;
  let statusLogWritten = false;
  const tx = {
    order: {
      updateMany: async () => ({ count: 0 }),
      findUnique: async () => order,
    },
    paymentIntent: {
      findUnique: async () => intent,
      update: async ({ data }: any) => { Object.assign(intent, data); return intent; },
    },
    paymentTransaction: {
      findFirst: async () => null,
      upsert: async () => {
        transactionWritten = true;
        return {
          paymentIntentId: intent.id, type: 'PAYMENT', status: 'SUCCEEDED',
          amountMinor: intent.amountMinor, currency: intent.currency,
        };
      },
    },
    orderStatusLog: { create: async () => { statusLogWritten = true; return {}; } },
  };
  const stock = { commit: async () => { assert.fail('inventory must not be committed'); } };

  await confirmSuccessfulPayment(tx as never, stock as never, {
    intentId: intent.id,
    orderId: order.id,
    orderNo: 'LD1',
    storeId: order.storeId,
    provider: 'WECHAT_PAY',
    channel: 'WECHAT',
    accountId: intent.accountId,
    providerIntentId: 'provider-1',
    eventId: 'event-completed',
    providerTransactionId: 'provider-txn-completed',
    occurredAt: new Date('2026-08-30T10:00:00.000Z'),
  });

  assert.equal(intent.reconciliationStatus, 'MATCHED');
  assert.equal(transactionWritten, true);
  assert.equal(statusLogWritten, false);
});

test('one provider transaction cannot credit a second payment intent', async () => {
  const order = { id: 'order-2', status: 'PENDING_PAYMENT', storeId: 'store-1' };
  const intent: any = {
    id: 'intent-2', paymentNo: 'PAY2', orderId: order.id, accountId: 'account-1',
    status: 'PROCESSING', providerIntentId: 'provider-2', amountMinor: 1880n,
    currency: 'CNY', paidAt: null, order,
  };
  let statusLogWritten = false;
  const tx = {
    order: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => order,
    },
    paymentIntent: {
      findUnique: async () => intent,
      update: async () => intent,
    },
    paymentTransaction: {
      findFirst: async () => null,
      upsert: async () => ({
        paymentIntentId: 'intent-already-credited',
        type: 'PAYMENT',
        status: 'SUCCEEDED',
        amountMinor: intent.amountMinor,
        currency: intent.currency,
      }),
    },
    orderStatusLog: { create: async () => { statusLogWritten = true; } },
  };
  const stock = { commit: async () => { assert.fail('inventory must not be committed'); } };

  await assert.rejects(
    () => confirmSuccessfulPayment(tx as never, stock as never, {
      intentId: intent.id,
      orderId: order.id,
      orderNo: 'LD2',
      storeId: order.storeId,
      provider: 'WECHAT_PAY',
      channel: 'WECHAT',
      accountId: intent.accountId,
      providerIntentId: intent.providerIntentId,
      eventId: 'event-duplicate-provider-transaction',
      providerTransactionId: 'provider-transaction-shared',
      occurredAt: new Date('2026-08-30T10:00:00.000Z'),
    }),
    /already assigned to a different payment fact/i,
  );
  assert.equal(statusLogWritten, false);
});

test('an out-of-order processing webhook cannot reactivate a failed intent', async () => {
  const account = {
    id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT',
    externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE',
  };
  const intent: any = {
    id: 'intent-failed', paymentNo: 'PAY-FAILED', orderId: 'order-1', accountId: account.id,
    provider: 'WECHAT_PAY', channel: 'WECHAT', status: 'FAILED', activeOrderKey: null,
    amountMinor: 1880n, currency: 'CNY', providerIntentId: 'provider-failed',
    order: { status: 'PENDING_PAYMENT', storeId: 'store-1' },
  };
  const payload = {
    event_id: 'event-processing-late', event_type: 'PAYMENT_PROCESSING' as const,
    payment_no: intent.paymentNo, provider_intent_id: intent.providerIntentId,
    account_external_id: account.externalAccountId, amount_minor: 1880, currency: 'CNY',
    occurred_at: '2026-08-30T10:00:00.000Z',
  };
  let updateWhere: any;
  let eventProcessed = false;
  const prisma = {
    paymentAccount: { findFirst: async () => account },
    paymentWebhookEvent: {
      create: async () => ({}),
      findUnique: async () => null,
      update: async () => { eventProcessed = true; return {}; },
    },
    paymentIntent: {
      findUnique: async () => intent,
      findUniqueOrThrow: async () => intent,
      updateMany: async ({ where }: any) => {
        updateWhere = where;
        return { count: where.status.in.includes(intent.status) ? 1 : 0 };
      },
    },
  };
  (prisma as any).$transaction = async (operation: (tx: typeof prisma) => Promise<unknown>) => operation(prisma);
  const service = testPaymentsService(prisma as never, {
    create: () => ({ verifyWebhook: () => payload }),
  } as never, storeContext as never);

  const result = await service.handleWebhook(
    'WECHAT_PAY', account.id, Buffer.from(JSON.stringify(payload)), {},
  );

  assert.deepEqual(result, { accepted: true, duplicate: false });
  assert.deepEqual(updateWhere.status, { in: ['CREATED', 'PENDING', 'PROCESSING'] });
  assert.equal(intent.status, 'FAILED');
  assert.equal(intent.activeOrderKey, null);
  assert.equal(eventProcessed, true);
});

test('malformed signed event fields are rejected before an event or payment fact is written', async () => {
  const valid = {
    event_type: 'PAYMENT_SUCCEEDED', event_id: 'event', payment_no: 'PAY', provider_intent_id: 'wx',
    account_external_id: 'account', provider_transaction_id: 'receipt', amount_minor: 100, currency: 'CNY',
    occurred_at: '2026-11-19T00:00:00Z',
  };
  for (const invalid of [{ occurred_at: null }, { event_id: 123 }, { provider_transaction_id: ' ' }, { failure_code: 'a'.repeat(65) }]) {
    const service = testPaymentsService({ paymentAccount: { findFirst: async () => ({ id: 'account' }) } },
      { create: () => ({ verifyWebhook: () => ({ ...valid, ...invalid }) }) }, storeContext);
    await assert.rejects(service.handleWebhook('WECHAT_PAY', 'account', Buffer.from('{}'), {}), /Invalid payment webhook payload/);
  }
});
