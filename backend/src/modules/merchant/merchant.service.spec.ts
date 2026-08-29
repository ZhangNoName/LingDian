import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MerchantService } from './merchant.service';
import { MerchantStoreScope } from './merchant-store-scope';

const merchantScope = new MerchantStoreScope({
  resolveStoreIds: (storeIds?: string[]) => {
    if (!storeIds?.includes('store-a')) throw new Error('outside configured store');
    return ['store-a'];
  },
} as never);

test('merchant stores endpoint returns only JWT-authorized stores', async () => {
  let query: unknown;
  const merchantService = new MerchantService({
    store: {
      findMany: async (input: unknown) => {
        query = input;
        return [
          { id: 'store-a', code: 'A', name: 'Store A', status: 'OPEN' },
          { id: 'store-b', code: 'B', name: 'Store B', status: 'OPEN' },
        ];
      },
    },
  } as never, merchantScope);

  const stores = await merchantService.listStores({
    userId: 'merchant-1',
    sessionId: 'session-1',
    audience: 'merchant-api',
    roles: ['MERCHANT'],
    merchantStoreIds: ['store-a'],
  });

  assert.deepEqual(stores.map((store) => store.id), ['store-a']);
  assert.deepEqual(query, {
    where: { id: { in: ['store-a'] } },
    select: { id: true, code: true, name: true, status: true },
    orderBy: { id: 'asc' },
  });
});

test('merchant scope rejects a requested store that is not in the JWT scope', async () => {
  const merchantService = new MerchantService(
    { store: { findMany: async () => [] } } as never,
    merchantScope,
  );
  const merchant = {
    userId: 'merchant-1', sessionId: 'session-1', audience: 'merchant-api' as const,
    roles: ['MERCHANT' as const], merchantStoreIds: ['store-a'],
  };

  assert.throws(() => merchantService.assertStoreAccess(merchant, 'store-b'), /not authorized/i);
});
