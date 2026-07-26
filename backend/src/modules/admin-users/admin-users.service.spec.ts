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
  const service = new AdminUsersService(prisma as never);

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
  const service = new AdminUsersService(prisma as never);
  await service.list({ page: 1, pageSize: 999 });
  assert.equal(take, 100);
});
