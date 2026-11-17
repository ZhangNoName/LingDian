import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MultiStoreContextResolver, SingleStoreContextResolver } from './store-context.resolver';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { MerchantService } from '../merchant/merchant.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersQueryService } from '../orders/orders-query.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { IntegrationOutboxService } from '../integrations/integration-outbox.service';
import { ProductsController } from '../products/products.controller';
import { OrdersController } from '../orders/orders.controller';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';

const user = (ids: string[]): AuthenticatedUser => ({ userId: 'merchant', sessionId: 's', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ids });
const config = { get: (key: string) => key === 'store.primaryStoreId' ? 'store-a' : 'multi' };
const resolver = (prisma: unknown = {}) => new MultiStoreContextResolver(prisma as never, config as never);

test('multi-store resolver preserves explicit contexts and rejects malformed or empty scopes', async () => {
  let query: unknown;
  const stores = resolver({ store: { findUnique: async (input: unknown) => { query = input; return { id: 'store-b', status: 'CLOSED' }; } } });
  assert.equal((await stores.resolveCurrentStore(undefined, 'store-b')).id, 'store-b');
  assert.deepEqual(query, { where: { id: 'store-b' } });
  assert.equal(stores.resolveRequestedStoreId(), 'store-a');
  assert.deepEqual(stores.resolveStoreIds(['store-b', 'store-a', 'store-b']), ['store-a', 'store-b']);
  assert.throws(() => stores.resolveStoreIds([]), /non-empty/);
  for (const id of ['', ' store-b', 'store-a,store-b', 'x'.repeat(192)]) assert.throws(() => stores.resolveRequestedStoreId(id));
  const single = new SingleStoreContextResolver({} as never, config as never);
  assert.throws(() => single.resolveRequestedStoreId('store-b'), /does not match/);
});

test('merchant store discovery and request selection never grant another merchant store', async () => {
  const scope = new MerchantStoreScope(resolver());
  let where: unknown;
  const service = new MerchantService({ store: { findMany: async (query: unknown) => {
    where = query;
    return [{ id: 'store-a' }, { id: 'store-b' }, { id: 'store-c' }];
  } } } as never, scope);
  assert.deepEqual((await service.listStores(user(['store-b']))).map((store) => store.id), ['store-b']);
  assert.deepEqual(where, { where: { id: { in: ['store-b'] } }, select: { id: true, code: true, name: true, status: true }, orderBy: { id: 'asc' } });
  assert.deepEqual(scope.forRequest(user(['store-a', 'store-b']), 'store-b'), ['store-b']);
  assert.throws(() => scope.forRequest(user(['store-a', 'store-b'])), /Select a store/);
  assert.throws(() => scope.forRequest(user(['store-a']), 'store-b'), /not authorized/);
  assert.throws(() => scope.forRequest({ ...user(['store-b']), audience: 'user-api' }, 'store-b'), /Merchant access/);
});

test('selected store scopes product, order and summary requests and rejects tampered headers before querying', () => {
  const scope = new MerchantStoreScope(resolver());
  const seen: unknown[] = [];
  const products = new ProductsController({ getProducts: (_query: unknown, ids: string[]) => seen.push(ids) } as never, scope);
  const orders = new OrdersController({ getOrders: (_query: unknown, value: unknown) => seen.push(value), getOrderSummary: (_query: unknown, value: unknown) => seen.push(value) } as never, scope);
  const merchant = user(['store-a', 'store-b']);
  products.getMerchantProducts(merchant, { page: 1, pageSize: 20 }, 'store-b');
  orders.getMerchantOrders(merchant, { page: 1, pageSize: 20 }, 'store-b');
  orders.getMerchantOrderSummary(merchant, { page: 1, pageSize: 20 }, 'store-a');
  assert.deepEqual(seen, [['store-b'], { storeIds: ['store-b'] }, { storeIds: ['store-a'] }]);
  assert.throws(() => products.getMerchantProducts(merchant, { page: 1, pageSize: 20 }, 'store-c'), /not authorized/);
  assert.throws(() => orders.getMerchantOrders(merchant, { page: 1, pageSize: 20 }), /Select a store/);
  assert.equal(seen.length, 3);
});

test('inventory scope checks reject foreign stores before reading an idempotent movement', async () => {
  let read = false;
  const inventory = new InventoryService({ inventoryMovement: { findUnique: async () => { read = true; } } } as never, new MerchantStoreScope(resolver()));
  await assert.rejects(inventory.adjust(user(['store-b']), 'store-a', 'item-a', { requestId: 'request-1', kind: 'ISSUE', amount: 1, expectedVersion: 0, reason: 'use' }), /not authorized/);
  assert.equal(read, false);
});

test('customer order reads retain owner scope across stores and merchant reads retain selected store', () => {
  const queries = new OrdersQueryService({} as never, resolver());
  assert.deepEqual(queries.scopeWhere({ customerUserId: 'customer' }), { customerUserId: 'customer' });
  assert.deepEqual(queries.scopeWhere({ storeIds: ['store-b'] }), { storeId: { in: ['store-b'] } });
  assert.throws(() => queries.scopeWhere({ storeIds: [] }), /non-empty/);
});

test('checkout checks availability of the requested store rather than the default store', async () => {
  let checkedStore: string | undefined;
  const tx = {
    order: { findFirst: async () => null },
    store: { findUnique: async ({ where }: any) => { checkedStore = where.id; return { id: where.id, status: where.id === 'store-a' ? 'OPEN' : 'CLOSED' }; } },
  };
  const stores = resolver(tx);
  const prisma = { ...tx, $transaction: async (fn: (tx: unknown) => unknown) => fn(tx) };
  const service = new OrdersService(prisma as never, {} as never, stores, new OrdersQueryService(prisma as never, stores), {} as never);
  await assert.rejects(service.createOrder({ storeId: 'store-b', orderType: 'pickup', paymentChannel: 'cash', customerName: 'Customer', mobile: '13800000000', items: [{ skuId: 'sku-b', quantity: 1 }] }), /Store is not available/);
  assert.equal(checkedStore, 'store-b');
});

test('non-default store payment retry verifies customer ownership before returning the intent', async () => {
  let where: unknown;
  const intent = { id: 'i', paymentNo: 'p', orderId: 'o', accountId: 'a', provider: 'WECHAT_PAY', channel: 'WECHAT', status: 'PENDING', reconciliationStatus: 'PENDING', amountMinor: 100n, currency: 'CNY', expiresAt: new Date(), paidAt: null };
  const service = new PaymentsService({
    order: { findFirst: async (input: any) => { where = input.where; return { id: 'o', storeId: 'store-b' }; } },
    paymentIntent: { findUnique: async () => intent },
  } as never, {} as never, resolver(), { isExpiredActiveIntent: () => false } as never, {} as never);
  const result = await service.createIntent('o', 'customer', { provider: 'WECHAT_PAY', channel: 'WECHAT', clientRequestId: 'r' });
  assert.equal(result.payment_no, 'p');
  assert.deepEqual(where, { id: 'o', customerUserId: 'customer', isDeleted: false });
});

test('multi-store outbox polling processes a non-default store row', async () => {
  let query: any;
  const delivered: unknown[] = [];
  const payload = { store_id: 'store-b', event_id: 'event-b' };
  const service = new IntegrationOutboxService({ integrationOutbox: {
    findMany: async (input: any) => { query = input; return [{ id: 'row-b', storeId: 'store-b', provider: 'CASHIER', payload }]; },
    updateMany: async () => ({ count: 1 }), update: async () => ({}),
  } } as never, { adapter: () => ({ deliver: async (event: unknown) => { delivered.push(event); } }) } as never, resolver());
  await service.flush();
  assert.equal(query.where.storeId, undefined);
  assert.deepEqual(delivered, [payload]);
});

test('a verified account from one store cannot credit an order in another store', async () => {
  let transactionStarted = false;
  let recordedError = '';
  const account = { id: 'account-b', provider: 'WECHAT_PAY', storeId: 'store-b', externalAccountId: 'recipient-b' };
  const payload = { event_id: 'event-1', event_type: 'PAYMENT_SUCCEEDED', payment_no: 'payment-a', provider_intent_id: 'external-1', account_external_id: 'recipient-b', amount_minor: 100, currency: 'CNY', provider_transaction_id: 'tx-1', occurred_at: '2026-11-17T10:00:00Z' };
  const service = new PaymentsService({
    paymentAccount: { findFirst: async () => account },
    paymentWebhookEvent: { create: async () => ({}), update: async ({ data }: any) => { recordedError = data.processingError; } },
    paymentIntent: { findUnique: async () => ({ accountId: account.id, providerIntentId: 'external-1', amountMinor: 100n, currency: 'CNY', order: { storeId: 'store-a' } }) },
    $transaction: async () => { transactionStarted = true; },
  } as never, { create: () => ({ verifyWebhook: () => payload }) } as never, resolver(), undefined, {} as never);
  await assert.rejects(service.handleWebhook('WECHAT_PAY', account.id, Buffer.from('{}'), {}), /reference, recipient, or amount mismatch/);
  assert.equal(recordedError, 'PAYMENT_REFERENCE_MISMATCH');
  assert.equal(transactionStarted, false);
});
