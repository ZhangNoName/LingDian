import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const MAX_TRANSACTION_ATTEMPTS = 3;

export async function bootstrapAccounts({ prisma, env }) {
  const config = readBootstrapConfig(env);
  assertDistinctPrincipals(config);

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await assertMerchantStoresExist(tx, config.merchant.storeIds);
        const admin = await upsertBootstrapUser(tx, {
          ...config.admin,
          roles: [
            { role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeId: '' },
            { role: 'ADMIN', scopeType: 'GLOBAL', scopeId: '' },
          ],
          replaceMerchantScopes: false,
        });
        const merchant = await upsertBootstrapUser(tx, {
          ...config.merchant,
          roles: config.merchant.storeIds.map((scopeId) => ({ role: 'MERCHANT', scopeType: 'STORE', scopeId })),
          replaceMerchantScopes: true,
        });
        return { admin, merchant };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isRetryableWriteConflict(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
    }
  }

  throw new Error('Bootstrap account transaction retry limit reached.');
}

function readBootstrapConfig(env) {
  return {
    admin: readAccount(env, 'SUPER_ADMIN'),
    merchant: {
      ...readAccount(env, 'MERCHANT'),
      storeIds: readStoreIds(env.AUTH_BOOTSTRAP_MERCHANT_STORE_IDS),
    },
  };
}

function readAccount(env, kind) {
  const prefix = `AUTH_BOOTSTRAP_${kind}_`;
  const names = [`${prefix}USERNAME`, `${prefix}PASSWORD`, `${prefix}PHONE`];
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Bootstrap ${kind.toLowerCase()} credentials are incomplete: ${missing.join(', ')} must be set.`);
  }

  const username = normalizeAccountName(env[`${prefix}USERNAME`]);
  const password = env[`${prefix}PASSWORD`];
  if (password.length < 8) throw new Error(`${prefix}PASSWORD must be at least 8 characters long.`);
  return { username, password, phone: normalizeChinesePhone(env[`${prefix}PHONE`]) };
}

function readStoreIds(value) {
  const storeIds = [...new Set((value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean))];
  if (storeIds.length === 0) throw new Error('AUTH_BOOTSTRAP_MERCHANT_STORE_IDS must list at least one store ID.');
  return storeIds;
}

function normalizeAccountName(value) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(normalized)) {
    throw new Error('Bootstrap account names must use 3-64 lowercase letters, digits, dots, underscores, or hyphens.');
  }
  return normalized;
}

function normalizeChinesePhone(value) {
  const trimmed = value.trim();
  if (/^1[3-9]\d{9}$/.test(trimmed)) return `+86${trimmed}`;
  if (/^\+861[3-9]\d{9}$/.test(trimmed)) return trimmed;
  throw new Error('Bootstrap account phone must be a mainland Chinese mobile number.');
}

function assertDistinctPrincipals(config) {
  const adminIdentifiers = new Set([config.admin.username, ...phoneAliases(config.admin.phone)]);
  const merchantIdentifiers = [config.merchant.username, ...phoneAliases(config.merchant.phone)];
  if (merchantIdentifiers.some((identifier) => adminIdentifiers.has(identifier))) {
    throw new Error('Bootstrap super administrator and merchant credentials must not collide.');
  }
}

function phoneAliases(phone) {
  return [phone, phone.startsWith('+86') ? phone.slice(3) : phone];
}

async function assertMerchantStoresExist(tx, storeIds) {
  const stores = await tx.store.findMany({ where: { id: { in: storeIds } }, select: { id: true } });
  if (stores.length !== storeIds.length) {
    throw new Error('AUTH_BOOTSTRAP_MERCHANT_STORE_IDS contains a store that does not exist.');
  }
}

async function upsertBootstrapUser(tx, input) {
  const account = await tx.authIdentity.findUnique({
    where: { accountName: input.username },
    include: { user: true },
  });
  const phone = await tx.authIdentity.findUnique({
    where: { phoneE164: input.phone },
    include: { user: true },
  });
  assertIdentityInvariants(account, phone, input);
  if (account && phone && account.userId !== phone.userId) {
    throw new Error(`Bootstrap account ${input.username} conflicts with the configured phone identity.`);
  }

  const existingUser = account?.user ?? phone?.user;
  const created = !existingUser;
  const user = existingUser ?? await tx.user.create({ data: {} });
  let changed = false;

  let accountIdentity = account;
  if (!accountIdentity) {
    accountIdentity = await tx.authIdentity.create({
      data: { userId: user.id, provider: 'ACCOUNT', subject: input.username, accountName: input.username },
    });
    changed = true;
  }

  if (!phone) {
    await tx.authIdentity.create({
      data: { userId: user.id, provider: 'PHONE', subject: input.phone, phoneE164: input.phone, verifiedAt: new Date() },
    });
    changed = true;
  } else if (!phone.verifiedAt) {
    await tx.authIdentity.update({ where: { id: phone.id }, data: { verifiedAt: new Date() } });
    changed = true;
  }

  const credential = await tx.passwordCredential.findUnique({ where: { identityId: accountIdentity.id } });
  if (!credential || !await verifyPassword(input.password, credential.passwordHash)) {
    const passwordHash = await hashPassword(input.password);
    await tx.passwordCredential.upsert({
      where: { identityId: accountIdentity.id },
      create: { identityId: accountIdentity.id, passwordHash },
      update: { passwordHash, passwordChangedAt: new Date() },
    });
    changed = true;
  }

  const rolesChanged = await ensureRoles(tx, user.id, input.roles, input.replaceMerchantScopes);
  changed ||= rolesChanged;
  if (user.status !== 'ACTIVE') {
    await tx.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
    changed = true;
  }

  if (!created && changed) {
    const now = new Date();
    await tx.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
    await tx.authSession.updateMany({
      where: { userId: user.id, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: now },
    });
  }

  return { created };
}

function assertIdentityInvariants(account, phone, input) {
  if (account && (account.provider !== 'ACCOUNT' || account.subject !== input.username || account.accountName !== input.username)) {
    throw new Error(`Bootstrap account identity invariant failed for ${input.username}.`);
  }
  if (phone && (phone.provider !== 'PHONE' || phone.subject !== input.phone || phone.phoneE164 !== input.phone)) {
    throw new Error(`Bootstrap phone identity invariant failed for ${input.phone}.`);
  }
}

async function ensureRoles(tx, userId, desiredRoles, replaceMerchantScopes) {
  const existing = await tx.userRoleAssignment.findMany({ where: { userId } });
  const desiredKeys = new Set(desiredRoles.map(roleKey));
  const relevant = existing.filter((role) => desiredRoles.some((desired) => desired.role === role.role) || (replaceMerchantScopes && role.role === 'MERCHANT'));
  const currentKeys = new Set(relevant.filter((role) => role.status === 'ACTIVE').map(roleKey));
  if (sameSet(currentKeys, desiredKeys) && relevant.every((role) => role.status === 'ACTIVE')) return false;

  const rolesToReplace = [...new Set(relevant.map((role) => role.role))];
  if (rolesToReplace.length > 0) {
    await tx.userRoleAssignment.deleteMany({ where: { userId, role: { in: rolesToReplace } } });
  }
  await tx.userRoleAssignment.createMany({
    data: desiredRoles.map((role) => ({ userId, ...role, status: 'ACTIVE' })),
  });
  return true;
}

function roleKey(role) {
  return `${role.role}:${role.scopeType}:${role.scopeId}`;
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function isRetryableWriteConflict(error) {
  return typeof error === 'object' && error !== null && ['P2034', 'P2002'].includes(error.code);
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await derivePassword(password, salt);
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

async function verifyPassword(password, encoded) {
  const fields = encoded.split('$');
  if (fields.length !== 6 || fields[0] !== 'scrypt' || fields[1] !== '32768' || fields[2] !== '8' || fields[3] !== '1') return false;
  const salt = Buffer.from(fields[4], 'base64url');
  const expected = Buffer.from(fields[5], 'base64url');
  if (salt.length !== 16 || expected.length !== 64 || salt.toString('base64url') !== fields[4] || expected.toString('base64url') !== fields[5]) return false;
  const candidate = await derivePassword(password, salt);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function derivePassword(password, salt) {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, SCRYPT_OPTIONS, (error, derivedKey) => error ? reject(error) : resolve(derivedKey));
  });
}
