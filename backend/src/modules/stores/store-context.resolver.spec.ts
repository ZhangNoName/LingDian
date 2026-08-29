import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SingleStoreContextResolver } from './store-context.resolver';

const primaryStore = {
  id: 'store-primary',
  code: 'PRIMARY',
  name: '主门店',
  contactName: null,
  contactPhone: null,
  address: null,
  businessHours: '09:00-22:00',
  status: 'CLOSED',
  dineInEnabled: true,
  takeoutEnabled: true,
  pickupEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function resolver(findUnique: (query: unknown) => Promise<unknown>) {
  return new SingleStoreContextResolver(
    { store: { findUnique } } as never,
    { get: (key: string) => key === 'store.primaryStoreId' ? 'store-primary' : undefined } as never,
  );
}

test('resolves only the configured primary store by its exact id', async () => {
  let query: unknown;
  const stores = resolver(async (input) => {
    query = input;
    return primaryStore;
  });

  assert.equal((await stores.resolveCurrentStore()).id, 'store-primary');
  assert.deepEqual(query, { where: { id: 'store-primary' } });
  assert.equal(stores.resolveRequestedStoreId(), 'store-primary');
  assert.equal(stores.resolveRequestedStoreId('store-primary'), 'store-primary');
});

test('rejects request ids and signed scopes outside the configured store', () => {
  const stores = resolver(async () => primaryStore);

  assert.throws(() => stores.resolveRequestedStoreId('store-other'), /does not match/i);
  assert.throws(() => stores.resolveStoreIds(['store-primary', 'store-other']), /outside the configured store/i);
  assert.throws(() => stores.resolveStoreIds(['store-other']), /outside the configured store/i);
  assert.deepEqual(stores.resolveStoreIds(), ['store-primary']);
});

test('readiness requires the primary row but does not require the store to be open', async () => {
  await resolver(async () => primaryStore).assertReady();
  await assert.rejects(
    () => resolver(async () => null).assertReady(),
    /Service is not ready/,
  );
  await assert.rejects(
    () => resolver(async () => { throw new Error('database details'); }).assertReady(),
    (error: unknown) => {
      assert.equal((error as Error).message, 'Service is not ready');
      return true;
    },
  );
});
