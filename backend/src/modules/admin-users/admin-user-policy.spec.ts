import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AdminUserPolicy } from './admin-user-policy';

test('super admin can manage lower-ranked accounts and assign lower roles', () => {
  assert.doesNotThrow(() => AdminUserPolicy.assertCanManage(['SUPER_ADMIN'], ['ADMIN'], ['ADMIN', 'USER']));
});

test('admin can manage users and merchants but not peer or super-admin accounts', () => {
  assert.doesNotThrow(() => AdminUserPolicy.assertCanManage(['ADMIN'], ['MERCHANT'], ['MERCHANT']));
  assert.throws(() => AdminUserPolicy.assertCanManage(['ADMIN'], ['ADMIN']), /higher authority/i);
  assert.throws(() => AdminUserPolicy.assertCanManage(['ADMIN'], ['SUPER_ADMIN']), /higher authority/i);
});

test('operator cannot grant a role at or above their own authority', () => {
  assert.throws(() => AdminUserPolicy.assertCanManage(['ADMIN'], ['USER'], ['ADMIN']), /assign/i);
  assert.throws(() => AdminUserPolicy.assertCanManage(['ADMIN'], ['USER'], ['SUPER_ADMIN']), /assign/i);
});

test('operator cannot manage their own account', () => {
  assert.throws(() => AdminUserPolicy.assertCanManage(['SUPER_ADMIN'], ['SUPER_ADMIN'], ['SUPER_ADMIN'], true), /own account/i);
});
