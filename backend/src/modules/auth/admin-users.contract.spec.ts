import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type {
  CreatePlatformUserRequest,
  PlatformUserPage,
  PlatformUserQuery,
  ResetPlatformUserPasswordRequest,
  UpdatePlatformUserRequest,
} from '@lingdian/contracts';

test('platform user contracts represent paginated administration without exposing credentials', () => {
  const query: PlatformUserQuery = { page: 1, pageSize: 20, role: 'MERCHANT', status: 'ACTIVE' };
  const page: PlatformUserPage = {
    items: [{
      userId: 'user-1',
      nickname: '零点店长',
      username: 'manager',
      phone: '+8613800000000',
      roles: ['MERCHANT'],
      storeIds: ['store-1'],
      status: 'ACTIVE',
      mustChangePassword: false,
      lastLoginAt: '2026-07-26T10:00:00.000Z',
      createdAt: '2026-07-01T10:00:00.000Z',
    }],
    page: 1,
    pageSize: 20,
    total: 1,
  };
  const create: CreatePlatformUserRequest = {
    nickname: '零点店长', username: 'manager', phone: '+8613800000000',
    password: 'strong-password', roles: ['MERCHANT'], storeIds: ['store-1'],
  };
  const update: UpdatePlatformUserRequest = { nickname: '新昵称', roles: ['MERCHANT'], storeIds: ['store-1'] };
  const reset: ResetPlatformUserPasswordRequest = { password: 'replacement-password' };

  assert.equal(query.pageSize, 20);
  assert.equal(page.items[0]?.username, 'manager');
  assert.equal(page.total, 1);
  assert.deepEqual(create.roles, ['MERCHANT']);
  assert.equal(update.nickname, '新昵称');
  assert.equal(reset.password, 'replacement-password');
  assert.equal('password' in page.items[0]!, false);
});
