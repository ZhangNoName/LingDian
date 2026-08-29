import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MerchantAdminService } from './merchant-admin.service';

const merchantInput = {
  username: 'store-owner',
  phone: '+8613800000000',
  password: 'merchant-password-123',
  storeIds: ['store-1'],
};

const storeContext = {
  resolveStoreIds: (storeIds: string[]) => {
    if (storeIds.length !== 1 || storeIds[0] !== 'store-1') {
      throw new Error('Store access is outside the configured store');
    }
    return ['store-1'];
  },
};

test('super administrator creates a merchant only when every requested store exists', async () => {
  let created = false;
  const merchants = new MerchantAdminService(
    {
      $transaction: async (work: (tx: unknown) => unknown) => work({
        store: { findMany: async () => [] },
        user: { create: async () => { created = true; } },
      }),
    } as never,
    { hash: async () => 'password-hash' } as never,
    { record: async () => undefined } as never,
    storeContext as never,
  );

  await assert.rejects(() => merchants.create(merchantInput), /store not found/i);
  assert.equal(created, false);
});

test('merchant creation deduplicates store scopes in one transaction', async () => {
  let createData: Record<string, unknown> | undefined;
  const merchants = new MerchantAdminService(
    {
      $transaction: async (work: (tx: unknown) => unknown) => work({
        store: { findMany: async () => [{ id: 'store-1' }] },
        user: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createData = data;
            return {
              id: 'merchant-1', status: 'ACTIVE',
              identities: [
                { provider: 'ACCOUNT', accountName: 'store-owner', phoneE164: null },
                { provider: 'PHONE', accountName: null, phoneE164: '+8613800000000' },
              ],
              roles: [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-1', status: 'ACTIVE' }],
            };
          },
        },
        authAuditLog: { create: async () => undefined },
      }),
    } as never,
    { hash: async () => 'password-hash' } as never,
    { record: async () => undefined } as never,
    storeContext as never,
  );

  await merchants.create({ ...merchantInput, storeIds: ['store-1', 'store-1'] });

  const roles = ((createData?.roles as { create?: Array<{ scopeId: string }> }).create) ?? [];
  assert.deepEqual(roles.map((role) => role.scopeId), ['store-1']);
});

test('merchant store scope rejects non-primary replacement and disabling revokes sessions', async () => {
  let userUpdate: Record<string, unknown> | undefined;
  let revoked = false;
  const merchants = new MerchantAdminService(
    {
      $transaction: async (work: (tx: unknown) => unknown) => work({
        user: {
          findUnique: async () => ({ id: 'merchant-1', status: 'ACTIVE', roles: [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-1' }] }),
          update: async ({ data }: { data: Record<string, unknown> }) => {
            userUpdate = data;
            return {
              id: 'merchant-1', status: 'DISABLED',
              identities: [
                { provider: 'ACCOUNT', accountName: 'store-owner', phoneE164: null },
                { provider: 'PHONE', accountName: null, phoneE164: '+8613800000000' },
              ],
              roles: [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-1', status: 'ACTIVE' }],
            };
          },
        },
        store: { findMany: async () => [{ id: 'store-2' }] },
        userRoleAssignment: { deleteMany: async () => undefined, createMany: async () => undefined },
        authSession: { updateMany: async () => { revoked = true; } },
        authAuditLog: { create: async () => undefined },
      }),
    } as never,
    {} as never,
    { record: async () => undefined } as never,
    storeContext as never,
  );

  await assert.rejects(() => merchants.update('merchant-1', { storeIds: [] }), /at least one store/i);
  await assert.rejects(
    () => merchants.update('merchant-1', { storeIds: ['store-2'] }),
    /outside the configured store/i,
  );
  await merchants.update('merchant-1', { enabled: false });

  assert.deepEqual(userUpdate, { status: 'DISABLED', sessionVersion: { increment: 1 } });
  assert.equal(revoked, true);
});

test('merchant creation retries a serializable write conflict before creating the account', async () => {
  let attempts = 0;
  const merchants = new MerchantAdminService(
    {
      $transaction: async (work: (tx: unknown) => unknown) => {
        attempts += 1;
        if (attempts === 1) throw { code: 'P2034' };
        return work({
          store: { findMany: async () => [{ id: 'store-1' }] },
          user: {
            create: async () => ({
              id: 'merchant-1', status: 'ACTIVE',
              identities: [
                { provider: 'ACCOUNT', accountName: 'store-owner', phoneE164: null },
                { provider: 'PHONE', accountName: null, phoneE164: '+8613800000000' },
              ],
              roles: [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-1', status: 'ACTIVE' }],
            }),
          },
          authAuditLog: { create: async () => undefined },
        });
      },
    } as never,
    { hash: async () => 'password-hash' } as never,
    { record: async () => undefined } as never,
    storeContext as never,
  );

  await merchants.create(merchantInput);

  assert.equal(attempts, 2);
});

test('merchant scope update retries a serializable write conflict before revoking sessions', async () => {
  let attempts = 0;
  const merchants = new MerchantAdminService(
    {
      $transaction: async (work: (tx: unknown) => unknown) => {
        attempts += 1;
        if (attempts === 1) throw { code: 'P2034' };
        return work({
          user: {
            findUnique: async () => ({
              id: 'merchant-1', status: 'ACTIVE',
              identities: [
                { provider: 'ACCOUNT', accountName: 'store-owner', phoneE164: null },
                { provider: 'PHONE', accountName: null, phoneE164: '+8613800000000' },
              ],
              roles: [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-2', status: 'ACTIVE' }],
            }),
            update: async () => ({
              id: 'merchant-1', status: 'ACTIVE',
              identities: [
                { provider: 'ACCOUNT', accountName: 'store-owner', phoneE164: null },
                { provider: 'PHONE', accountName: null, phoneE164: '+8613800000000' },
              ],
              roles: [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-1', status: 'ACTIVE' }],
            }),
          },
          store: { findMany: async () => [{ id: 'store-1' }] },
          userRoleAssignment: { deleteMany: async () => undefined, createMany: async () => undefined },
          authSession: { updateMany: async () => undefined },
          authAuditLog: { create: async () => undefined },
        });
      },
    } as never,
    {} as never,
    { record: async () => undefined } as never,
    storeContext as never,
  );

  await merchants.update('merchant-1', { storeIds: ['store-1'] });

  assert.equal(attempts, 2);
});
