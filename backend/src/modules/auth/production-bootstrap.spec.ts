import { strict as assert } from 'node:assert';
import { test } from 'node:test';

const loadBootstrap = () => new Function('path', 'return import(path)')('../../../scripts/production-bootstrap.lib.mjs') as Promise<{
  bootstrapProduction(input: { prisma: unknown; env: Record<string, string> }): Promise<Record<string, any>>;
}>;

const environment = {
  NODE_ENV: 'production',
  ALLOW_DEMO_SEED: 'false',
  STORE_MODE: 'single',
  PRIMARY_STORE_ID: 'store-zsf-main',
  STORE_BOOTSTRAP_CODE: 'ZSF-MAIN',
  STORE_BOOTSTRAP_NAME: '知食坊中心店',
  AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME: 'platform-root',
  AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'K7!vN2#qP9@x',
  AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE: '13800000001',
  AUTH_BOOTSTRAP_MERCHANT_USERNAME: 'store-operator',
  AUTH_BOOTSTRAP_MERCHANT_PASSWORD: 'R4@tY8!mQ2#z',
  AUTH_BOOTSTRAP_MERCHANT_PHONE: '13800000002',
  AUTH_BOOTSTRAP_MERCHANT_STORE_IDS: 'store-zsf-main',
};

test('production bootstrap atomically creates a closed first store and scoped accounts', async () => {
  const persistence = createPersistence();
  const { bootstrapProduction } = await loadBootstrap();

  const result = await bootstrapProduction({ prisma: persistence, env: environment });

  assert.equal(result.store.created, true);
  assert.equal(persistence.stores.get('store-zsf-main')?.status, 'CLOSED');
  assert.ok([...persistence.users.values()].every((user) => user.mustChangePassword === true));
  assert.deepEqual(
    persistence.roles.map((role) => [role.role, role.scopeType, role.scopeId]),
    [
      ['SUPER_ADMIN', 'GLOBAL', ''],
      ['ADMIN', 'GLOBAL', ''],
      ['MERCHANT', 'STORE', 'store-zsf-main'],
    ],
  );
  assert.equal(persistence.transactionOptions[0]?.isolationLevel, 'Serializable');
});

test('production bootstrap is idempotent and does not rewrite an existing matching store', async () => {
  const persistence = createPersistence();
  const { bootstrapProduction } = await loadBootstrap();

  await bootstrapProduction({ prisma: persistence, env: environment });
  for (const user of persistence.users.values()) user.mustChangePassword = false;
  const firstWriteCount = persistence.writes;
  const result = await bootstrapProduction({ prisma: persistence, env: environment });

  assert.equal(result.store.created, false);
  assert.equal(result.admin.created, false);
  assert.equal(result.admin.changed, false);
  assert.equal(result.merchant.created, false);
  assert.equal(result.merchant.changed, false);
  assert.equal(persistence.writes, firstWriteCount);
  assert.ok([...persistence.users.values()].every((user) => user.mustChangePassword === false));
});

test('production bootstrap refuses demo configuration and weak credentials before starting a transaction', async () => {
  const persistence = createPersistence();
  const { bootstrapProduction } = await loadBootstrap();

  await assert.rejects(
    () => bootstrapProduction({ prisma: persistence, env: { ...environment, STORE_BOOTSTRAP_NAME: 'Demo Store' } }),
    /refuses demo/i,
  );
  await assert.rejects(
    () => bootstrapProduction({ prisma: persistence, env: { ...environment, AUTH_BOOTSTRAP_MERCHANT_USERNAME: 'merchant-demo' } }),
    /refuses demo/i,
  );
  await assert.rejects(
    () => bootstrapProduction({ prisma: persistence, env: { ...environment, AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'Password123!' } }),
    /weak or account-derived/i,
  );
  await assert.rejects(
    () => bootstrapProduction({ prisma: persistence, env: { ...environment, ALLOW_DEMO_SEED: 'true' } }),
    /refuses ALLOW_DEMO_SEED/i,
  );
  assert.equal(persistence.transactions, 0);
});

test('production bootstrap never overwrites an existing store identity', async () => {
  const persistence = createPersistence({ stores: [{ id: 'store-zsf-main', code: 'OTHER-CODE', name: 'Existing' }] });
  const { bootstrapProduction } = await loadBootstrap();

  await assert.rejects(
    () => bootstrapProduction({ prisma: persistence, env: environment }),
    /different store code/i,
  );
  assert.equal(persistence.writes, 0);
});

function createPersistence(options: { stores?: Array<Record<string, any>> } = {}) {
  const stores = new Map((options.stores ?? []).map((store) => [store.id, { ...store }]));
  const users = new Map<string, Record<string, any>>();
  const identities: Array<Record<string, any>> = [];
  const credentials = new Map<string, Record<string, any>>();
  const roles: Array<Record<string, any>> = [];
  let userSequence = 0;
  let identitySequence = 0;

  const persistence = {
    transactions: 0,
    writes: 0,
    stores,
    users,
    roles,
    transactionOptions: [] as Array<{ isolationLevel?: string } | undefined>,
    $transaction: async (work: (tx: unknown) => Promise<unknown>, transactionOptions?: { isolationLevel?: string }) => {
      persistence.transactions += 1;
      persistence.transactionOptions.push(transactionOptions);
      return work(tx);
    },
  };

  const tx = {
    store: {
      findUnique: async ({ where }: { where: { id?: string; code?: string } }) => {
        if (where.id) return stores.get(where.id) ?? null;
        return [...stores.values()].find((store) => store.code === where.code) ?? null;
      },
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => stores.has(id)).map((id) => ({ id })),
      create: async ({ data }: { data: Record<string, any> }) => {
        persistence.writes += 1;
        stores.set(data.id, { ...data });
        return data;
      },
    },
    authIdentity: {
      findUnique: async ({ where }: { where: { accountName?: string; phoneE164?: string } }) => {
        const identity = identities.find((candidate) =>
          (where.accountName !== undefined && candidate.accountName === where.accountName) ||
          (where.phoneE164 !== undefined && candidate.phoneE164 === where.phoneE164),
        );
        return identity ? { ...identity, user: users.get(identity.userId) } : null;
      },
      create: async ({ data }: { data: Record<string, any> }) => {
        persistence.writes += 1;
        const identity = { id: `identity-${++identitySequence}`, ...data };
        identities.push(identity);
        return identity;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        persistence.writes += 1;
        Object.assign(identities.find((identity) => identity.id === where.id)!, data);
      },
    },
    user: {
      create: async () => {
        persistence.writes += 1;
        const user = { id: `user-${++userSequence}`, status: 'ACTIVE', sessionVersion: 1, mustChangePassword: false };
        users.set(user.id, user);
        return user;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        persistence.writes += 1;
        const user = users.get(where.id)!;
        if (data.status) user.status = data.status;
        if (data.mustChangePassword !== undefined) user.mustChangePassword = data.mustChangePassword;
        if (data.sessionVersion?.increment) user.sessionVersion += data.sessionVersion.increment;
        return user;
      },
    },
    passwordCredential: {
      findUnique: async ({ where }: { where: { identityId: string } }) => credentials.get(where.identityId) ?? null,
      upsert: async ({ where, create, update }: { where: { identityId: string }; create: Record<string, any>; update: Record<string, any> }) => {
        persistence.writes += 1;
        const current = credentials.get(where.identityId);
        credentials.set(where.identityId, current ? { ...current, ...update } : { ...create });
      },
    },
    userRoleAssignment: {
      findMany: async ({ where }: { where: { userId: string } }) => roles.filter((role) => role.userId === where.userId),
      deleteMany: async ({ where }: { where: { userId: string; role: { in: string[] } } }) => {
        persistence.writes += 1;
        for (let index = roles.length - 1; index >= 0; index -= 1) {
          if (roles[index].userId === where.userId && where.role.in.includes(roles[index].role)) roles.splice(index, 1);
        }
      },
      createMany: async ({ data }: { data: Array<Record<string, any>> }) => {
        persistence.writes += 1;
        roles.push(...data);
      },
    },
    authSession: { updateMany: async () => { persistence.writes += 1; } },
  };

  return persistence;
}
