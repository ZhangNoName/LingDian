import { strict as assert } from 'node:assert';
import { test } from 'node:test';

const loadBootstrap = () => new Function('path', 'return import(path)')('../../../scripts/auth-bootstrap.lib.mjs') as Promise<{
  bootstrapAccounts(input: { prisma: unknown; env: Record<string, string> }): Promise<unknown>;
}>;

const environment = {
  AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME: 'admin-root',
  AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'admin-password-123',
  AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE: '13800000001',
  AUTH_BOOTSTRAP_MERCHANT_USERNAME: 'merchant-demo',
  AUTH_BOOTSTRAP_MERCHANT_PASSWORD: 'merchant-password-123',
  AUTH_BOOTSTRAP_MERCHANT_PHONE: '13800000002',
  AUTH_BOOTSTRAP_MERCHANT_STORE_IDS: 'store-1',
};

test('bootstrap revalidates merchant stores inside every retryable serializable transaction attempt', async () => {
  for (const conflictCode of ['P2034', 'P2002']) {
    const persistence = createPersistence({ transactionFailures: [conflictCode] });
    const { bootstrapAccounts } = await loadBootstrap();

    await bootstrapAccounts({ prisma: persistence, env: environment });

    assert.equal(persistence.storeReads, 2);
    assert.equal(persistence.transactionOptions[0]?.isolationLevel, 'Serializable');
    assert.equal(persistence.transactionOptions[1]?.isolationLevel, 'Serializable');
  }
});

test('first bootstrap creates the required administrator and store-scoped merchant roles', async () => {
  const persistence = createPersistence();
  const { bootstrapAccounts } = await loadBootstrap();

  await bootstrapAccounts({ prisma: persistence, env: environment });

  assert.deepEqual(
    persistence.roles.map((role) => [role.role, role.scopeType, role.scopeId]),
    [
      ['SUPER_ADMIN', 'GLOBAL', ''],
      ['ADMIN', 'GLOBAL', ''],
      ['MERCHANT', 'STORE', 'store-1'],
    ],
  );
});

test('bootstrap accepts a nine-character password and rejects a password shorter than eight characters', async () => {
  const { bootstrapAccounts } = await loadBootstrap();
  const nineCharacterPassword = 'boot-pass';

  await bootstrapAccounts({
    prisma: createPersistence(),
    env: { ...environment, AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD: nineCharacterPassword },
  });

  await assert.rejects(
    () => bootstrapAccounts({
      prisma: createPersistence(),
      env: { ...environment, AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'short7!' },
    }),
    /at least 8 characters/i,
  );
});

test('bootstrap rejects admin and merchant principal collisions before starting a transaction', async () => {
  const persistence = createPersistence();
  const { bootstrapAccounts } = await loadBootstrap();

  await assert.rejects(
    () => bootstrapAccounts({
      prisma: persistence,
      env: { ...environment, AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME: environment.AUTH_BOOTSTRAP_MERCHANT_PHONE },
    }),
    /must not collide/i,
  );
  assert.equal(persistence.transactions, 0);
});

test('bootstrap rejects an account-name match whose provider or subject violates the account invariant', async () => {
  const persistence = createPersistence({
    accountIdentity: {
      id: 'identity-1', userId: 'user-1', provider: 'PHONE', subject: 'not-admin-root', accountName: 'admin-root',
      user: { id: 'user-1', status: 'ACTIVE' },
    },
  });
  const { bootstrapAccounts } = await loadBootstrap();

  await assert.rejects(() => bootstrapAccounts({ prisma: persistence, env: environment }), /account identity invariant/i);
  assert.equal(persistence.writes, 0);
});

test('bootstrap rejects a phone-identity match whose provider or subject violates the phone invariant', async () => {
  const persistence = createPersistence({
    phoneIdentity: {
      id: 'identity-2', userId: 'user-2', provider: 'PHONE', subject: '+8613800000009', phoneE164: '+8613800000002',
      user: { id: 'user-2', status: 'ACTIVE' },
    },
  });
  const { bootstrapAccounts } = await loadBootstrap();

  await assert.rejects(() => bootstrapAccounts({ prisma: persistence, env: environment }), /phone identity invariant/i);
  assert.equal(persistence.identityUpdates, 0);
});

function createPersistence(options: {
  transactionFailures?: string[];
  accountIdentity?: Record<string, unknown>;
  phoneIdentity?: Record<string, unknown>;
} = {}) {
  const failures = [...(options.transactionFailures ?? [])];
  const roles: Array<Record<string, unknown>> = [];
  const identities: Array<Record<string, unknown>> = [options.accountIdentity, options.phoneIdentity].filter(Boolean) as Array<Record<string, unknown>>;
  let userId = 0;
  let identityId = 0;
  let credential: Record<string, unknown> | null = null;

  const persistence = {
    transactions: 0,
    storeReads: 0,
    identityUpdates: 0,
    writes: 0,
    roles,
    transactionOptions: [] as Array<{ isolationLevel?: string } | undefined>,
    $transaction: async (work: (tx: unknown) => Promise<unknown>, transactionOptions?: { isolationLevel?: string }) => {
      persistence.transactions += 1;
      persistence.transactionOptions.push(transactionOptions);
      const result = await work(tx);
      const code = failures.shift();
      if (code) throw { code };
      return result;
    },
  };

  const tx = {
    store: {
      findMany: async () => {
        persistence.storeReads += 1;
        return [{ id: 'store-1' }];
      },
    },
    authIdentity: {
      findUnique: async ({ where }: { where: { accountName?: string; phoneE164?: string } }) => {
        const identity = identities.find((candidate) =>
          (where.accountName !== undefined && candidate.accountName === where.accountName) ||
          (where.phoneE164 !== undefined && candidate.phoneE164 === where.phoneE164),
        );
        return identity ?? null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        persistence.writes += 1;
        const identity = { id: `identity-${++identityId}`, ...data };
        identities.push(identity);
        return identity;
      },
      update: async () => {
        persistence.writes += 1;
        persistence.identityUpdates += 1;
      },
    },
    user: {
      create: async () => {
        persistence.writes += 1;
        return { id: `user-${++userId}`, status: 'ACTIVE' };
      },
      update: async () => { persistence.writes += 1; },
    },
    passwordCredential: {
      findUnique: async () => credential,
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        persistence.writes += 1;
        credential = create;
      },
    },
    userRoleAssignment: {
      findMany: async () => roles,
      deleteMany: async () => { persistence.writes += 1; },
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        persistence.writes += 1;
        roles.push(...data);
      },
    },
    authSession: { updateMany: async () => { persistence.writes += 1; } },
  };

  return persistence;
}
