import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AccountAuthService } from './account-auth.service';
import { PasswordService } from './password.service';

const loadBootstrap = () => new Function('path', 'return import(path)')('../../../scripts/auth-bootstrap.lib.mjs') as Promise<{
  bootstrapAccounts(input: { prisma: unknown; env: Record<string, string> }): Promise<unknown>;
  seedLocalMerchant(input: { prisma: unknown; env: NodeJS.ProcessEnv }): Promise<string>;
}>;

const environment = {
  STORE_MODE: 'single',
  PRIMARY_STORE_ID: 'store-1',
  AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME: 'platform-root',
  AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'K7!vN2#qP9@x',
  AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE: '13800000001',
  AUTH_BOOTSTRAP_MERCHANT_USERNAME: 'store-operator',
  AUTH_BOOTSTRAP_MERCHANT_PASSWORD: 'R4@tY8!mQ2#z',
  AUTH_BOOTSTRAP_MERCHANT_PHONE: '13800000002',
  AUTH_BOOTSTRAP_MERCHANT_STORE_IDS: 'store-1',
};

const localEnvironment = {
  NODE_ENV: 'development',
  DATABASE_URL: 'mysql://127.0.0.1/lingdian_test',
  PRIMARY_STORE_ID: 'store-1',
};

test('local initialization signs in through the merchant audience and preserves credentials on repeat runs', async () => {
  const { seedLocalMerchant } = await loadBootstrap();
  let credential: { passwordHash: string } | undefined;
  const roles: Array<{ role: string; scopeType: string; scopeId: string; status: string }> = [];
  const tx = {
    store: { findUnique: async () => ({ id: 'store-1' }) },
    authIdentity: { findFirst: async () => credential ? { user: { roles } } : null },
    user: {
      create: async ({ data }: { data: {
        identities: { create: { accountName: string; provider: string; subject: string; passwordCredential: { create: { passwordHash: string } } } };
        roles: { create: { role: string; scopeType: string; scopeId: string } };
      } }) => {
        assert.equal(credential, undefined);
        const { accountName, provider, subject, passwordCredential } = data.identities.create;
        assert.deepEqual([accountName, provider, subject], ['admin', 'ACCOUNT', 'admin']);
        credential = passwordCredential.create;
        roles.push({ ...data.roles.create, status: 'ACTIVE' });
      },
    },
  };
  const prisma = { $transaction: async (run: (scope: typeof tx) => Promise<string>) => run(tx) };
  assert.equal(await seedLocalMerchant({ prisma, env: localEnvironment }), 'created');
  assert.deepEqual(roles, [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-1', status: 'ACTIVE' }]);

  const passwords = new PasswordService({} as never, {} as never);
  const service = new AccountAuthService(
    {
      authIdentity: { findUnique: async () => ({ passwordCredential: credential, user: { id: 'user', status: 'ACTIVE', sessionVersion: 1, roles } }) },
      user: { update: async () => undefined },
    } as never,
    {} as never,
    { create: async (user: { merchantStoreIds: string[] }, audience: string) => ({ user: { ...user, audience } }) } as never,
    passwords,
    { record: async () => undefined } as never,
  );
  const login = { username: 'admin', password: 'Admin@020206', audience: 'merchant-api' } as const;
  const context = { deviceId: 'web', ip: '127.0.0.1' };
  const session = await service.login(login, context);
  assert.equal(session.user.audience, 'merchant-api');
  assert.deepEqual(session.user.merchantStoreIds, ['store-1']);
  await assert.rejects(() => service.login({ ...login, audience: 'admin-api' }, context), /credentials.*invalid/i);

  const changedHash = await passwords.hash('Changed-password7!');
  credential = { passwordHash: changedHash };
  assert.equal(await seedLocalMerchant({ prisma, env: localEnvironment }), 'unchanged');
  assert.equal(credential.passwordHash, changedHash);
});

test('default merchant initialization skips an occupied username and rejects non-local environments before writing', async () => {
  const { seedLocalMerchant } = await loadBootstrap();
  const tx = {
    store: { findUnique: async () => ({ id: 'store-1' }) },
    authIdentity: { findFirst: async () => ({ user: { roles: [] } }) },
  };
  const prisma = { $transaction: async (run: (scope: typeof tx) => Promise<string>) => run(tx) };
  assert.equal(await seedLocalMerchant({ prisma, env: localEnvironment }), 'occupied');
  for (const overrides of [
    { NODE_ENV: 'production' },
    { DATABASE_MODE: 'external' },
    { DATABASE_URL: 'mysql://remote.example/lingdian_test' },
  ]) {
    await assert.rejects(() => seedLocalMerchant({ prisma: {}, env: { ...localEnvironment, ...overrides } }), /loopback database/);
  }
});

test('bootstrap rejects a merchant scope outside the configured primary store before writing', async () => {
  const persistence = createPersistence();
  const { bootstrapAccounts } = await loadBootstrap();

  await assert.rejects(
    () => bootstrapAccounts({
      prisma: persistence,
      env: { ...environment, AUTH_BOOTSTRAP_MERCHANT_STORE_IDS: 'store-2' },
    }),
    /must contain only PRIMARY_STORE_ID/i,
  );
  assert.equal(persistence.transactions, 0);
});

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

test('bootstrap requires distinct 12-character complex passwords and rejects weak values before writing', async () => {
  const { bootstrapAccounts } = await loadBootstrap();
  const persistence = createPersistence();

  await bootstrapAccounts({ prisma: persistence, env: environment });

  await assert.rejects(
    () => bootstrapAccounts({
      prisma: createPersistence(),
      env: { ...environment, AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'Short7!' },
    }),
    /12-128 characters/i,
  );
  await assert.rejects(
    () => bootstrapAccounts({
      prisma: createPersistence(),
      env: { ...environment, AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'Password123!' },
    }),
    /weak or account-derived/i,
  );
  await assert.rejects(
    () => bootstrapAccounts({
      prisma: createPersistence(),
      env: { ...environment, AUTH_BOOTSTRAP_MERCHANT_PASSWORD: environment.AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD },
    }),
    /passwords must be different/i,
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
      id: 'identity-1', userId: 'user-1', provider: 'PHONE', subject: 'not-platform-root', accountName: 'platform-root',
      user: { id: 'user-1', status: 'ACTIVE' },
    },
  });
  const { bootstrapAccounts } = await loadBootstrap();

  await assert.rejects(
    () => bootstrapAccounts({ prisma: persistence, env: environment }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /account identity invariant/i);
      assert.doesNotMatch(error.message, /platform-root|13800000001/);
      return true;
    },
  );
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

  await assert.rejects(
    () => bootstrapAccounts({ prisma: persistence, env: environment }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /phone identity invariant/i);
      assert.doesNotMatch(error.message, /13800000002|\+8613800000002/);
      return true;
    },
  );
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
