import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PaymentsService } from './payments.service';

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

test('createIntent selects the receiving account from the order store and validates the connector echo', async () => {
  let gatewayInput: any;
  const now = new Date();
  const account = { id: 'account-1', storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT', externalAccountId: 'mch-1', connectorConfigKey: 'STORE_1', status: 'ACTIVE' };
  const created = { id: 'intent-1', paymentNo: 'PAY1', orderId: 'order-1', accountId: account.id, provider: 'WECHAT_PAY', channel: 'WECHAT', status: 'CREATED', reconciliationStatus: 'PENDING', amountMinor: 1880n, currency: 'CNY', clientRequestId: 'request-1', providerIntentId: null, clientAction: null, expiresAt: now, paidAt: null };
  const prisma = {
    paymentIntent: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async ({ data }: any) => ({ ...created, ...data }),
      update: async ({ data }: any) => ({ ...created, ...data }),
      updateMany: async () => ({ count: 0 }),
    },
    order: { findFirst: async () => ({ id: 'order-1', orderNo: 'LD1', storeId: 'store-1', status: 'PENDING_PAYMENT', paymentChannel: 'CASH', payableAmount: 18.8 }), updateMany: async () => ({ count: 1 }) },
    paymentAccount: { findUnique: async ({ where }: any) => {
      assert.deepEqual(where.storeId_provider_channel, { storeId: 'store-1', provider: 'WECHAT_PAY', channel: 'WECHAT' });
      return account;
    } },
  };
  const gateways = { create: () => ({ createIntent: async (input: any) => {
    gatewayInput = input;
    return { providerIntentId: 'wx-1', status: 'PENDING', accountExternalId: 'mch-1', amountMinor: 1880, currency: 'CNY', clientAction: { token: 'client-only' } };
  } }) };
  const service = new PaymentsService(prisma as never, gateways as never, storeContext as never);
  const result = await service.createIntent('order-1', 'user-1', { provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'request-1' });
  assert.equal(gatewayInput.amountMinor, 1880);
  assert.equal(result.amount_minor, 1880);
  assert.equal(result.payment_no, 'PAY1');
});

test('createIntent rejects a connector response that redirects funds to another recipient', async () => {
  const account = { id: 'account-1', storeId: 'store-1', provider: 'ALIPAY', channel: 'ALIPAY', externalAccountId: 'merchant-correct', connectorConfigKey: 'STORE_1', status: 'ACTIVE' };
  const intent = { id: 'intent-1', paymentNo: 'PAY1', orderId: 'order-1', accountId: account.id, provider: 'ALIPAY', channel: 'ALIPAY', status: 'CREATED', amountMinor: 100n, currency: 'CNY', clientRequestId: 'request-1', clientAction: null, expiresAt: new Date(), paidAt: null };
  let failed = false;
  const prisma = {
    paymentIntent: { findUnique: async () => null, findFirst: async () => null, create: async () => intent, update: async () => { failed = true; return intent; }, updateMany: async () => ({ count: 0 }) },
    order: { findFirst: async () => ({ id: 'order-1', orderNo: 'LD1', storeId: 'store-1', status: 'PENDING_PAYMENT', paymentChannel: 'CASH', payableAmount: 1 }), updateMany: async () => ({ count: 1 }) },
    paymentAccount: { findUnique: async () => account },
  };
  const gateways = { create: () => ({ createIntent: async () => ({ providerIntentId: 'ali-1', status: 'PENDING', accountExternalId: 'attacker', amountMinor: 100, currency: 'CNY', clientAction: null }) }) };
  const service = new PaymentsService(prisma as never, gateways as never, storeContext as never);
  await assert.rejects(() => service.createIntent('order-1', 'user-1', { provider: 'ALIPAY', channel: 'ALIPAY', clientRequestId: 'request-1' }), /mismatched recipient/i);
  assert.equal(failed, true);
});

test('idempotency lookup never discloses an intent before order ownership and store scope are verified', async () => {
  let intentLookup = false;
  const service = new PaymentsService({
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
    expiresAt: new Date('2026-08-29T10:15:00Z'),
    paidAt: null,
  };
  let authorizedWhere: unknown;
  const service = new PaymentsService({
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
  const service = new PaymentsService({
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
        return duplicateLookups === 1 ? null : duplicate;
      },
      findFirst: async () => null,
      create: async () => { throw { code: 'P2002' }; },
    },
  } as never, {
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

  assert.equal(duplicateLookups, 2);
  assert.equal(gatewayCalls, 0);
  assert.equal(result.payment_no, 'PAY-RACE-WINNER');
});
