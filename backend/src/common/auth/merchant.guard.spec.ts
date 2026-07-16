import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MerchantGuard } from './merchant.guard';
import { AuthenticatedUser } from './authenticated-user.type';

function contextWith(user: AuthenticatedUser) {
  return { switchToHttp: () => ({ getRequest: () => ({ user }) }) };
}

test('MerchantGuard rejects an admin-api token with MERCHANT role', async () => {
  const guard = new MerchantGuard();

  await assert.rejects(
    () => guard.canActivate(contextWith({ userId: 'merchant-1', sessionId: 'session-1', audience: 'admin-api', roles: ['MERCHANT'] }) as never),
    /merchant audience required/i,
  );
});

test('MerchantGuard accepts a merchant-api token with a store-scoped MERCHANT role', async () => {
  const guard = new MerchantGuard();

  assert.equal(
    await guard.canActivate(contextWith({ userId: 'merchant-1', sessionId: 'session-1', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ['store-1'] }) as never),
    true,
  );
});

test('MerchantGuard rejects a merchant token without a store scope claim', async () => {
  const guard = new MerchantGuard();

  await assert.rejects(
    () => guard.canActivate(contextWith({ userId: 'merchant-1', sessionId: 'session-1', audience: 'merchant-api', roles: ['MERCHANT'] }) as never),
    /store scope required/i,
  );
});
