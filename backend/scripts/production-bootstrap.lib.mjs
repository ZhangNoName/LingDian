import {
  bootstrapAccountsInTransaction,
  validateBootstrapAccountsConfig,
} from './auth-bootstrap.lib.mjs';

const MAX_TRANSACTION_ATTEMPTS = 3;
const DEMO_MARKER = /(demo|example|swiftbite|\btest\b|演示|示例|测试)/i;

export async function bootstrapProduction({ prisma, env }) {
  const storeConfig = readProductionStoreConfig(env);
  const accountConfig = validateBootstrapAccountsConfig(env);
  if ([accountConfig.admin.username, accountConfig.merchant.username].some((value) => DEMO_MARKER.test(value))) {
    throw new Error('Production bootstrap refuses demo, example, or test account names.');
  }

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const store = await ensureProductionStore(tx, storeConfig);
        const accounts = await bootstrapAccountsInTransaction({ tx, config: accountConfig });
        return { store, ...accounts };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isRetryableWriteConflict(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
    }
  }

  throw new Error('Production bootstrap transaction retry limit reached.');
}

export function readProductionStoreConfig(env) {
  if (env.NODE_ENV !== 'production') {
    throw new Error('Production bootstrap requires NODE_ENV=production.');
  }
  if (env.ALLOW_DEMO_SEED === 'true') {
    throw new Error('Production bootstrap refuses ALLOW_DEMO_SEED=true.');
  }
  const id = readRequiredValue(env, 'PRIMARY_STORE_ID', 191);
  if (env.STORE_MODE !== 'single' || id.includes(',')) {
    throw new Error('Production bootstrap requires STORE_MODE=single and exactly one PRIMARY_STORE_ID.');
  }

  const code = readRequiredValue(env, 'STORE_BOOTSTRAP_CODE', 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(code)) {
    throw new Error('STORE_BOOTSTRAP_CODE must use 2-64 letters, digits, dots, underscores, or hyphens.');
  }
  const name = readRequiredValue(env, 'STORE_BOOTSTRAP_NAME', 100);
  if (name.length < 2) throw new Error('STORE_BOOTSTRAP_NAME must contain 2-100 characters.');
  if ([id, code, name].some((value) => DEMO_MARKER.test(value))) {
    throw new Error('Production bootstrap refuses demo, example, or test store identities.');
  }

  const status = env.STORE_BOOTSTRAP_STATUS?.trim() || 'CLOSED';
  if (!['OPEN', 'CLOSED', 'RESTING'].includes(status)) {
    throw new Error('STORE_BOOTSTRAP_STATUS must be OPEN, CLOSED, or RESTING.');
  }

  return {
    id,
    code,
    name,
    status,
    contactName: readOptionalValue(env, 'STORE_BOOTSTRAP_CONTACT_NAME', 191),
    contactPhone: readOptionalValue(env, 'STORE_BOOTSTRAP_CONTACT_PHONE', 191),
    address: readOptionalValue(env, 'STORE_BOOTSTRAP_ADDRESS', 191),
    businessHours: readOptionalValue(env, 'STORE_BOOTSTRAP_BUSINESS_HOURS', 191),
  };
}

async function ensureProductionStore(tx, config) {
  const [byId, byCode] = await Promise.all([
    tx.store.findUnique({ where: { id: config.id }, select: { id: true, code: true } }),
    tx.store.findUnique({ where: { code: config.code }, select: { id: true, code: true } }),
  ]);

  if (byCode && byCode.id !== config.id) {
    throw new Error('STORE_BOOTSTRAP_CODE already belongs to a different store.');
  }
  if (byId) {
    if (byId.code !== config.code) {
      throw new Error('PRIMARY_STORE_ID exists with a different store code; refusing to overwrite store identity.');
    }
    return { created: false };
  }

  await tx.store.create({
    data: {
      id: config.id,
      code: config.code,
      name: config.name,
      status: config.status,
      ...(config.contactName ? { contactName: config.contactName } : {}),
      ...(config.contactPhone ? { contactPhone: config.contactPhone } : {}),
      ...(config.address ? { address: config.address } : {}),
      ...(config.businessHours ? { businessHours: config.businessHours } : {}),
    },
  });
  return { created: true };
}

function readRequiredValue(env, name, maxLength) {
  const value = env[name];
  if (!value?.trim()) throw new Error(`${name} is required for production bootstrap.`);
  if (value !== value.trim()) throw new Error(`${name} must not contain leading or trailing whitespace.`);
  if (value.length > maxLength) throw new Error(`${name} must not exceed ${maxLength} characters.`);
  return value;
}

function readOptionalValue(env, name, maxLength) {
  const value = env[name];
  if (!value?.trim()) return undefined;
  if (value !== value.trim()) throw new Error(`${name} must not contain leading or trailing whitespace.`);
  if (value.length > maxLength) throw new Error(`${name} must not exceed ${maxLength} characters.`);
  return value;
}

function isRetryableWriteConflict(error) {
  return typeof error === 'object' && error !== null && ['P2034', 'P2002'].includes(error.code);
}
