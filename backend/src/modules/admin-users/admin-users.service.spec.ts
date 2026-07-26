import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AdminUsersService } from './admin-users.service';

test('lists platform users with pagination and flattened active roles and store scopes', async () => {
  let captured: Record<string, unknown> | undefined;
  const prisma = {
    user: {
      count: async () => 1,
      findMany: async (args: Record<string, unknown>) => {
        captured = args;
        return [{
          id: 'user-1', nickname: '店长', status: 'ACTIVE', mustChangePassword: false,
          lastLoginAt: new Date('2026-07-26T10:00:00.000Z'), createdAt: new Date('2026-07-01T10:00:00.000Z'),
          identities: [
            { provider: 'ACCOUNT', accountName: 'manager', phoneE164: null },
            { provider: 'PHONE', accountName: null, phoneE164: '+8613800000000' },
          ],
          roles: [
            { role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-1', status: 'ACTIVE' },
            { role: 'USER', scopeType: 'GLOBAL', scopeId: '', status: 'DISABLED' },
          ],
        }];
      },
    },
  };
  const service = new AdminUsersService(prisma as never, { hash: async () => 'hashed' } as never);

  const result = await service.list({ page: 2, pageSize: 20, keyword: '店 长', role: 'MERCHANT' });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.username, 'manager');
  assert.equal(result.items[0]?.phone, '+8613800000000');
  assert.deepEqual(result.items[0]?.roles, ['MERCHANT']);
  assert.deepEqual(result.items[0]?.storeIds, ['store-1']);
  assert.equal(captured?.skip, 20);
  assert.equal(captured?.take, 20);
});

test('clamps platform user page size to one hundred', async () => {
  let take = 0;
  const prisma = { user: { count: async () => 0, findMany: async ({ take: value }: { take: number }) => { take = value; return []; } } };
  const service = new AdminUsersService(prisma as never, { hash: async () => 'hashed' } as never);
  await service.list({ page: 1, pageSize: 999 });
  assert.equal(take, 100);
});

test('disabling an account revokes sessions and increments its session version', async () => {
  const writes: string[] = [];
  const tx = {
    user: {
      findUnique: async () => ({ id: 'target', roles: [{ role: 'USER', status: 'ACTIVE', scopeType: 'GLOBAL', scopeId: '' }], identities: [{ id: 'account-1', provider: 'ACCOUNT' }, { id: 'phone-1', provider: 'PHONE' }] }),
      update: async () => { writes.push('user'); return {}; },
    },
    authSession: { updateMany: async () => { writes.push('sessions'); return { count: 1 }; } },
    authAuditLog: { create: async () => { writes.push('audit'); return {}; } },
  };
  const prisma = { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) };
  const service = new AdminUsersService(prisma as never, { hash: async () => 'hashed' } as never);

  await service.setStatus({ userId: 'operator', roles: ['ADMIN'] } as never, 'target', 'DISABLED');

  assert.deepEqual(writes, ['user', 'sessions', 'audit']);
});

test('creates a platform account with global roles and store-scoped merchant assignments', async () => {
  let created: Record<string, unknown> | undefined;
  const tx = {
    store: { findMany: async () => [{ id: 'store-1' }] },
    user: { create: async ({ data }: { data: Record<string, unknown> }) => { created = data; return { id: 'new-user' }; } },
    authAuditLog: { create: async () => ({}) },
  };
  const prisma = { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) };
  const service = new AdminUsersService(prisma as never, { hash: async () => 'hashed' } as never);

  await service.create(
    { userId: 'root', roles: ['SUPER_ADMIN'] } as never,
    { nickname: '店长', username: 'manager', phone: '13800000000', password: 'strong-password', roles: ['USER', 'MERCHANT'], storeIds: ['store-1'] },
  );

  assert.equal((created?.identities as { create: Array<{ provider: string }> }).create.length, 2);
  assert.deepEqual(
    (created?.roles as { create: Array<{ role: string; scopeType: string; scopeId: string }> }).create,
    [
      { role: 'USER', scopeType: 'GLOBAL', scopeId: '' },
      { role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-1' },
    ],
  );
});

test('editing roles revokes sessions so stale authority cannot continue', async () => {
  const writes: string[] = [];
  const tx = {
    store: { findMany: async () => [{ id: 'store-1' }] },
    user: {
      findUnique: async () => ({ id: 'target', roles: [{ role: 'USER', status: 'ACTIVE', scopeType: 'GLOBAL', scopeId: '' }], identities: [{ id: 'account-1', provider: 'ACCOUNT' }, { id: 'phone-1', provider: 'PHONE' }] }),
      update: async () => { writes.push('user'); return {}; },
    },
    authIdentity: { update: async () => ({}) },
    userRoleAssignment: { deleteMany: async () => { writes.push('roles-delete'); }, createMany: async () => { writes.push('roles-create'); } },
    authSession: { updateMany: async () => { writes.push('sessions'); return { count: 1 }; } },
    authAuditLog: { create: async () => { writes.push('audit'); return {}; } },
  };
  const prisma = { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) };
  const service = new AdminUsersService(prisma as never, { hash: async () => 'hashed' } as never);

  await service.update({ userId: 'root', roles: ['SUPER_ADMIN'] } as never, 'target', { roles: ['MERCHANT'], storeIds: ['store-1'] });

  assert.deepEqual(writes, ['user', 'roles-delete', 'roles-create', 'sessions', 'audit']);
});

test('administrator password reset forces next-login change and revokes sessions', async () => {
  const writes: string[] = [];
  const tx = {
    user: {
      findUnique: async () => ({ id: 'target', roles: [{ role: 'USER', status: 'ACTIVE', scopeType: 'GLOBAL', scopeId: '' }], identities: [{ id: 'identity-1', provider: 'ACCOUNT' }] }),
      update: async () => { writes.push('user'); return {}; },
    },
    passwordCredential: { update: async () => { writes.push('password'); return {}; } },
    authSession: { updateMany: async () => { writes.push('sessions'); return { count: 1 }; } },
    authAuditLog: { create: async () => { writes.push('audit'); return {}; } },
  };
  const prisma = { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) };
  const service = new AdminUsersService(prisma as never, { hash: async () => 'hashed' } as never);

  await service.resetPassword({ userId: 'root', roles: ['SUPER_ADMIN'] } as never, 'target', 'replacement-password');

  assert.deepEqual(writes, ['password', 'user', 'sessions', 'audit']);
});

test('returns active store options for merchant scope editing', async () => {
  const prisma = { store: { findMany: async () => [{ id: 'store-1', name: '旗舰店' }] } };
  const service = new AdminUsersService(prisma as never, { hash: async () => 'hashed' } as never);
  assert.deepEqual(await service.listStoreOptions(), [{ id: 'store-1', name: '旗舰店' }]);
});
