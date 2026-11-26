import type { AuthAudience, AuthenticatedUser, MobileAuthTokens } from '@lingdian/contracts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/api-error';
import { AuthManager } from '../src/auth-manager';

const customer = { audience: 'user-api', phone: '13800000000', code: '123456' } as const;
const merchant = { audience: 'merchant-api', username: 'test-merchant', password: 'test-password' } as const;

function tokens(audience: AuthAudience, token = audience): MobileAuthTokens {
  const user: AuthenticatedUser = { userId: 'user-1', sessionId: audience, audience, roles: ['USER', 'MERCHANT'] };
  return { access_token: token, refresh_token: `refresh-${token}`, expires_in: 120, user };
}

function fixture(request: ConstructorParameters<typeof AuthManager>[0]['request']) {
  const saved = new Map<string, string>();
  const auth = new AuthManager({
    realm: 'test-api',
    createDeviceId: () => 'test-installation',
    storage: {
      get: async (key) => saved.get(key) ?? null,
      set: async (key, value) => { saved.set(key, value); },
      remove: async (key) => { saved.delete(key); },
    },
    request,
  });
  return { auth, saved };
}

test('logout blocks identity changes and coalesces duplicate taps', async () => {
  const finishLogout = Promise.withResolvers<void>();
  const calls: string[] = [];
  const { auth, saved } = fixture(async <T>(path: string) => {
    calls.push(path);
    if (path === '/auth/mobile/phone/login') return tokens('user-api') as T;
    if (path === '/auth/mobile/account/switch') return tokens('merchant-api') as T;
    assert.equal(path, '/auth/logout');
    await finishLogout.promise;
    return undefined as T;
  });
  await auth.restore();
  await auth.signIn('user', customer);
  await auth.signIn('merchant', merchant);

  const logout = auth.logout();
  const repeated = auth.logout();
  try {
    assert.equal(auth.snapshot().loggingOut, true);
    await assert.rejects(auth.switchWorkspace('user'), { status: 409 });
    await assert.rejects(auth.signIn('user', customer), { status: 409 });
    await assert.rejects(auth.authenticated('merchant', 'merchant-api', undefined, '/private'), { status: 401 });
  } finally {
    finishLogout.resolve();
    await Promise.all([logout, repeated]);
  }
  assert.equal(calls.filter((path) => path === '/auth/logout').length, 2);
  assert.equal(auth.snapshot().user, null);
  assert.deepEqual([...saved.keys()], ['lingdian-mobile-installation']);
});

test('logout uses the credentials from a refresh already in flight', async () => {
  const startRefresh = Promise.withResolvers<void>();
  const finishRefresh = Promise.withResolvers<void>();
  const { auth } = fixture(async <T>(path: string, _options?: object, headers?: { token?: string }) => {
    if (path === '/auth/mobile/phone/login') return tokens('user-api') as T;
    if (path === '/private') throw new ApiError(401, 'expired');
    if (path === '/auth/mobile/refresh') {
      startRefresh.resolve();
      await finishRefresh.promise;
      return tokens('user-api', 'rotated') as T;
    }
    assert.equal(path, '/auth/logout');
    assert.equal(headers?.token, 'rotated');
    return undefined as T;
  });
  await auth.restore();
  await auth.signIn('user', customer);
  const rejected = assert.rejects(auth.authenticated('user', 'user-api', undefined, '/private'), { status: 401 });
  await startRefresh.promise;
  const logout = auth.logout();
  finishRefresh.resolve();
  await Promise.all([logout, rejected]);
  assert.equal(auth.snapshot().user, null);
});


test('password sign-in uses the only workspace returned by the server', async () => {
  const { auth, saved } = fixture(async <T>(path: string, options?: { body?: object }) => {
    assert.equal(path, '/auth/mobile/account/login');
    assert.deepEqual(options?.body, { username: merchant.username, password: merchant.password });
    return tokens('merchant-api') as T;
  });
  await auth.restore();
  const credentials = { username: merchant.username, password: merchant.password };
  assert.equal(await auth.signInWithAccount(credentials), undefined);
  assert.equal(auth.snapshot().workspace, 'merchant');
  assert.equal(saved.get('lingdian-mobile-workspace-test-api'), 'merchant');
});

test('password sign-in waits for an explicit choice when eligible for two workspaces', async () => {
  const { auth, saved } = fixture(async <T>(path: string, options?: { body?: object }) => {
    assert.equal(path, '/auth/mobile/account/login');
    const body = options?.body ?? {};
    if (!('audience' in body)) return { audiences: ['merchant-api', 'admin-api'] } as T;
    assert.equal(body.audience, 'admin-api');
    return tokens('admin-api') as T;
  });
  await auth.restore();
  const credentials = { username: merchant.username, password: merchant.password };
  assert.deepEqual(await auth.signInWithAccount(credentials), ['merchant', 'admin']);
  assert.equal(auth.snapshot().user, null);
  assert.deepEqual([...saved.keys()], ['lingdian-mobile-installation']);

  await auth.signIn('admin', { ...credentials, audience: 'admin-api' });
  assert.equal(auth.snapshot().workspace, 'admin');
  assert.equal(auth.snapshot().user?.audience, 'admin-api');
});
