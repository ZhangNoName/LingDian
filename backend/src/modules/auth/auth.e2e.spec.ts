import { strict as assert } from 'node:assert';
import { createHmac, scryptSync } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { MOBILE_LEGAL_DOCUMENT_VERSIONS } from '@lingdian/contracts';
import { Controller, Get, Param, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser = require('cookie-parser');
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { corsOptions } from '../../common/auth/http-security';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { OrdersController } from '../orders/orders.controller';
import { OrdersService } from '../orders/orders.service';
import { StoreContextResolver } from '../stores/store-context.resolver';
import { SystemLogAdminController } from '../system-log/system-log.controller';
import { SystemLogService } from '../system-log/system-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { AuthController } from './auth.controller';
import { ProfileService } from './profile.service';
import { AccountAuthService } from './account-auth.service';
import { AuthService } from './auth.service';
import { LegalConsentService } from './legal-consent.service';
import { MobileAuthController } from './mobile-auth.controller';
import { OAuthService } from './oauth.service';
import { PasswordService } from './password.service';
import { SMS_PROVIDER, SmsProvider } from './providers/sms-provider';
import { AUTH_REFRESH_PEPPER, VerificationService } from './verification.service';
import { SessionService } from './session.service';

type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'MERCHANT';
type Audience = 'USER_API' | 'ADMIN_API' | 'MERCHANT_API';
type Purpose = 'PHONE_LOGIN' | 'PHONE_LINK' | 'ADMIN_LOGIN' | 'PASSWORD_RESET';

const currentConsent = {
  userAgreementVersion: '2026-08-17',
  privacyPolicyVersion: '2026-08-17',
};

type StoredRole = {
  role: Role;
  scopeType?: 'GLOBAL' | 'STORE';
  scopeId?: string;
  status: 'ACTIVE';
};

type StoredUser = {
  id: string;
  status: 'ACTIVE';
  sessionVersion: number;
  roles: StoredRole[];
  identities: Array<{ id: string; provider: 'PHONE' | 'ACCOUNT'; phoneE164: string | null; verifiedAt: Date | null }>;
};

type StoredSession = {
  id: string;
  userId: string;
  audience: Audience;
  activeDeviceKey: string | null;
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  refreshTokenHistory: string[];
  device: string;
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: Date;
  revokedAt: Date | null;
};

type StoredVerificationCode = {
  id: string;
  purpose: Purpose;
  targetHash: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

type StoredAuditLog = {
  event: string;
  ip?: string;
  device?: string;
  createdAt: Date;
};

/**
 * Stateful Prisma-shaped persistence adapter for this HTTP regression. There
 * is no disposable MySQL database configured for the repository test suite.
 * It isolates persistence only; controllers, verification, auth/session
 * services, cookies, JWTs, and guards remain the production implementations.
 */
class StatefulAuthPersistence {
  private readonly users = new Map<string, StoredUser>();
  private readonly phoneUserIds = new Map<string, string>();
  private readonly accountIdentities = new Map<string, { id: string; passwordCredential: { passwordHash: string }; user: StoredUser }>();
  private readonly sessions = new Map<string, StoredSession>();
  private readonly verificationCodes: StoredVerificationCode[] = [];
  private readonly auditLogs: StoredAuditLog[] = [];
  private nextUser = 1;
  private nextSession = 1;
  private nextCode = 1;

  readonly authIdentity = {
    findUnique: async ({ where }: { where: { provider_subject: { provider: string; subject: string } } }) => {
      if (where.provider_subject.provider === 'ACCOUNT') {
        return this.accountIdentities.get(where.provider_subject.subject) ?? null;
      }
      const userId = this.phoneUserIds.get(where.provider_subject.subject);
      const user = userId ? this.users.get(userId) : undefined;
      return user ? { user } : null;
    },
  };

  readonly user = {
    create: async ({ data }: { data: { identities: { create: { subject: string } }; roles: { create: { role: Role } } } }) => {
      const id = `user-${this.nextUser++}`;
      const user: StoredUser = {
        id,
        status: 'ACTIVE',
        sessionVersion: 1,
        roles: [{ role: data.roles.create.role, status: 'ACTIVE' }],
        identities: [{ id: `phone-${id}`, provider: 'PHONE', phoneE164: data.identities.create.subject, verifiedAt: new Date() }],
      };
      this.users.set(id, user);
      this.phoneUserIds.set(data.identities.create.subject, id);
      return user;
    },
    update: async ({ where }: { where: { id: string }; data: { lastLoginAt?: Date } }) => {
      const user = this.users.get(where.id);
      if (!user) throw new Error(`Unknown test user: ${where.id}`);
      return user;
    },
  };

  readonly authSession = {
    create: async ({ data }: { data: Omit<StoredSession, 'id' | 'status' | 'revokedAt'> }) => {
      if (data.activeDeviceKey && [...this.sessions.values()].some((session) => session.activeDeviceKey === data.activeDeviceKey)) {
        throw { code: 'P2002' };
      }
      const persisted = data;
      const session: StoredSession = { id: `session-${this.nextSession++}`, status: 'ACTIVE', revokedAt: null, ...persisted };
      this.sessions.set(session.id, session);
      return session;
    },
    findUnique: async ({ where }: { where: { id?: string; refreshTokenHash?: string } }) => {
      const session = [...this.sessions.values()].find(
        (candidate) => candidate.id === where.id || candidate.refreshTokenHash === where.refreshTokenHash,
      );
      if (!session) return null;
      const user = this.users.get(session.userId);
      return user ? { ...session, user } : null;
    },
    findFirst: async ({ where }: { where: { OR?: Array<{ refreshTokenHash?: string; previousRefreshTokenHash?: string; refreshTokenHistory?: { array_contains: string[] } }>; previousRefreshTokenHash?: string } }) => {
      const session = [...this.sessions.values()].find((candidate) =>
        (where.previousRefreshTokenHash !== undefined && candidate.previousRefreshTokenHash === where.previousRefreshTokenHash) ||
        where.OR?.some((condition) =>
          (condition.refreshTokenHash !== undefined && candidate.refreshTokenHash === condition.refreshTokenHash) ||
          (condition.previousRefreshTokenHash !== undefined && candidate.previousRefreshTokenHash === condition.previousRefreshTokenHash) ||
          (condition.refreshTokenHistory?.array_contains.some((hash) => candidate.refreshTokenHistory.includes(hash)) ?? false),
        ),
      );
      if (!session) return null;
      const user = this.users.get(session.userId);
      return user ? { ...session, user } : null;
    },
    updateMany: async ({ where, data }: { where: { id?: string; status?: 'ACTIVE'; userId?: string; audience?: Audience; activeDeviceKey?: string; device?: string; refreshTokenHash?: string; expiresAt?: { gt: Date } }; data: Partial<StoredSession> }) => {
      let count = 0;
      for (const session of this.sessions.values()) {
        if ((where.id === undefined || session.id === where.id) &&
          (where.userId === undefined || session.userId === where.userId) &&
          (where.audience === undefined || session.audience === where.audience) &&
          (where.activeDeviceKey === undefined || session.activeDeviceKey === where.activeDeviceKey) &&
          (where.device === undefined || session.device === where.device) &&
          (where.status === undefined || session.status === where.status) &&
          (where.refreshTokenHash === undefined || session.refreshTokenHash === where.refreshTokenHash) &&
          (where.expiresAt === undefined || session.expiresAt > where.expiresAt.gt)) {
          Object.assign(session, data);
          count += 1;
        }
      }
      return { count };
    },
  };

  readonly verificationCode = {
    count: async ({ where }: { where: { targetHash?: string; consumedAt?: null; createdAt?: { gte: Date }; expiresAt?: { gt: Date } } }) =>
      this.verificationCodes.filter((code) => this.matchesVerificationCode(code, where)).length,
    findFirst: async ({
      where,
    }: {
      where: { purpose?: Purpose; targetHash?: string; codeHash?: string; consumedAt?: null; expiresAt?: { gt: Date } };
      orderBy?: { createdAt: 'desc' };
    }) => this.verificationCodes
      .filter((code) => this.matchesVerificationCode(code, where))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null,
    create: async ({ data }: { data: Omit<StoredVerificationCode, 'id' | 'createdAt' | 'consumedAt'> }) => {
      const code: StoredVerificationCode = { id: `code-${this.nextCode++}`, createdAt: new Date(), consumedAt: null, ...data };
      this.verificationCodes.push(code);
      return code;
    },
    updateMany: async ({
      data,
      where,
    }: {
      data: Pick<StoredVerificationCode, 'consumedAt'>;
      where: { id: string; consumedAt: null; expiresAt: { gt: Date } };
    }) => {
      const code = this.verificationCodes.find((candidate) => this.matchesVerificationCode(candidate, where));
      if (!code) return { count: 0 };
      Object.assign(code, data);
      return { count: 1 };
    },
  };

  readonly authAuditLog = {
    create: async ({ data }: { data: Omit<StoredAuditLog, 'createdAt'> }) => {
      this.auditLogs.push({ ...data, createdAt: new Date() });
      return data;
    },
    count: async ({ where }: { where: { event: string; ip?: string; device?: string; createdAt?: { gte: Date } } }) =>
      this.auditLogs.filter((entry) =>
        entry.event === where.event &&
        (where.ip === undefined || entry.ip === where.ip) &&
        (where.device === undefined || entry.device === where.device) &&
        (where.createdAt?.gte === undefined || entry.createdAt >= where.createdAt.gte),
      ).length,
  };

  readonly userLegalConsent = {
    createMany: async ({ data }: { data: unknown[] }) => ({ count: data.length }),
  };

  async $transaction<T>(input: ((transaction: this) => Promise<T>) | Promise<unknown>[]): Promise<T | unknown[]> {
    return Array.isArray(input) ? Promise.all(input) : input(this);
  }

  grantAdmin(userId: string): void {
    const user = this.users.get(userId);
    assert.ok(user, 'the phone login must create a user before the role is granted');
    user.roles.push({ role: 'ADMIN', status: 'ACTIVE' });
  }

  addAccount(input: {
    username: string;
    passwordHash: string;
    roles: Array<Omit<StoredRole, 'status'>>;
    phoneE164?: string;
  }): void {
    const id = `user-${this.nextUser++}`;
    const accountId = `account-${id}`;
    const user: StoredUser = {
      id,
      status: 'ACTIVE',
      sessionVersion: 1,
      roles: input.roles.map((role) => ({ ...role, status: 'ACTIVE' })),
      identities: [
        { id: accountId, provider: 'ACCOUNT', phoneE164: null, verifiedAt: null },
        { id: `phone-${id}`, provider: 'PHONE', phoneE164: input.phoneE164 ?? `+861380000${String(this.nextUser).padStart(2, '0')}`, verifiedAt: new Date() },
      ],
    };
    this.users.set(id, user);
    if (input.phoneE164) this.phoneUserIds.set(input.phoneE164, id);
    this.accountIdentities.set(input.username, {
      id: accountId,
      passwordCredential: { passwordHash: input.passwordHash },
      user,
    });
  }

  consumedVerificationCodeCount(): number {
    return this.verificationCodes.filter((code) => code.consumedAt !== null).length;
  }

  private matchesVerificationCode(
    code: StoredVerificationCode,
    where: { purpose?: Purpose; targetHash?: string; codeHash?: string; consumedAt?: null; createdAt?: { gte: Date }; expiresAt?: { gt: Date }; id?: string },
  ): boolean {
    return (where.id === undefined || code.id === where.id) &&
      (where.purpose === undefined || code.purpose === where.purpose) &&
      (where.targetHash === undefined || code.targetHash === where.targetHash) &&
      (where.codeHash === undefined || code.codeHash === where.codeHash) &&
      (where.consumedAt === undefined || code.consumedAt === where.consumedAt) &&
      (where.createdAt?.gte === undefined || code.createdAt >= where.createdAt.gte) &&
      (where.expiresAt?.gt === undefined || code.expiresAt > where.expiresAt.gt);
  }
}

class CapturingSmsProvider implements SmsProvider {
  private readonly codes: string[] = [];

  async send({ code }: { phoneE164: string; code: string }): Promise<{ messageId: string }> {
    this.codes.push(code);
    return { messageId: `test-sms-${this.codes.length}` };
  }

  latestCode(): string {
    const code = this.codes[this.codes.length - 1];
    assert.ok(code, 'the real verification service must dispatch a code before login');
    return code;
  }
}

function fixturePasswordHash(password: string): string {
  const salt = Buffer.from('0123456789abcdef');
  const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

@Controller('admin')
class AdminProbeController {
  @UseGuards(AccessTokenGuard, AdminGuard)
  @Get('probe')
  probe() {
    return { ok: true };
  }
}

@Controller('merchant')
class MerchantProbeController {
  constructor(private readonly stores: MerchantStoreScope) {}

  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Get('probe')
  probe() {
    return { ok: true };
  }

  @UseGuards(AccessTokenGuard, MerchantGuard)
  @Get('probe/:storeId')
  probeStore(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string) {
    this.stores.assertIncludes(user, storeId);
    return { ok: true, storeId };
  }
}

@Controller('user')
class UserProbeController {
  @UseGuards(AccessTokenGuard, UserApiGuard)
  @Get('probe')
  probe() {
    return { ok: true };
  }
}

test('same phone resolves one user across clients and a revoked admin session cannot refresh or access admin', async (t) => {
  const database = new StatefulAuthPersistence();
  const sms = new CapturingSmsProvider();
  const configValues: Record<string, unknown> = {
    'auth.jwtAccessSecret': 'test-access-secret-that-is-long-enough-for-the-auth-flow',
    'auth.refreshPepper': 'test-refresh-pepper-that-is-long-enough-for-the-auth-flow',
    'auth.accessTokenTtlSeconds': 900,
    'auth.refreshTokenTtlDays': 30,
    'auth.cookieSecure': false,
  };
  const config = {
    get: <T>(key: string, defaultValue?: T) => (configValues[key] ?? defaultValue) as T,
    getOrThrow: <T>(key: string) => {
      const value = configValues[key];
      if (value === undefined) throw new Error(`Missing test configuration for ${key}`);
      return value as T;
    },
  } as ConfigService;
  const jwt = new JwtService({ secret: config.getOrThrow<string>('auth.jwtAccessSecret') });
  const module = await Test.createTestingModule({
    controllers: [AuthController, AdminProbeController],
    providers: [
      AuditService,
      LegalConsentService,
      VerificationService,
      AuthService,
      { provide: AccountAuthService, useValue: {} },
      { provide: ProfileService, useValue: { setNickname: async () => ({ nickname: 'test' }) } },
      SessionService,
      AccessTokenGuard,
      AdminGuard,
      { provide: PrismaService, useValue: database },
      { provide: SMS_PROVIDER, useValue: sms },
      { provide: OAuthService, useValue: {} },
      { provide: JwtService, useValue: jwt },
      { provide: AUTH_REFRESH_PEPPER, useValue: config.getOrThrow<string>('auth.refreshPepper') },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors(corsOptions({ CORS_ALLOWED_ORIGINS: 'http://localhost:5173' }));
  await app.listen(0);
  t.after(async () => app.close());

  const baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  const issueCode = async (purpose: 'PHONE_LOGIN' | 'ADMIN_LOGIN', deviceId: string) => {
    const response = await fetch(`${baseUrl}/api/auth/codes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ purpose, phone: '13800000000', deviceId }),
    });
    assert.equal(response.status, 201);
    return sms.latestCode();
  };
  const login = async (deviceId: string, audience: 'user-api' | 'admin-api') => {
    const code = await issueCode(audience === 'admin-api' ? 'ADMIN_LOGIN' : 'PHONE_LOGIN', deviceId);
    const response = await fetch(`${baseUrl}/api/auth/phone/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-device-id': deviceId },
      body: JSON.stringify({
        phone: '13800000000',
        code,
        audience,
        ...(audience === 'user-api' ? { legalConsent: currentConsent } : {}),
      }),
    });
    assert.equal(response.status, 201);
    const refreshCookie = response.headers.get('set-cookie');
    assert.ok(refreshCookie, 'a successful phone login must set the refresh cookie');
    assert.match(refreshCookie, /^refresh_token=[^;]+;/);
    assert.match(refreshCookie, /HttpOnly/);
    assert.match(refreshCookie, /SameSite=Lax/);
    assert.match(refreshCookie, /Path=\/api\/auth/);
    assert.match(refreshCookie, /Max-Age=2592000/);
    return {
      body: await response.json() as { access_token: string; user: { userId: string; sessionId: string } },
      refreshCookie: refreshCookie.split(';', 1)[0],
    };
  };

  const miniProgramLogin = await login('mini-program-device', 'user-api');
  const webLogin = await login('web-browser-device', 'user-api');
  assert.equal(miniProgramLogin.body.user.userId, webLogin.body.user.userId);
  const storedWebSession = await database.authSession.findUnique({ where: { refreshTokenHash: createHmac('sha256', 'test-refresh-pepper-that-is-long-enough-for-the-auth-flow').update(webLogin.refreshCookie.slice('refresh_token='.length)).digest('hex') } });
  assert.ok(storedWebSession);
  assert.equal(storedWebSession.status, 'ACTIVE');
  assert.ok(storedWebSession.expiresAt > new Date());

  const firstRefresh = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { cookie: webLogin.refreshCookie, 'x-device-id': 'web-browser-device' },
  });
  assert.equal(firstRefresh.status, 201, 'the first refresh must rotate and succeed');
  const successorCookie = firstRefresh.headers.get('set-cookie');
  assert.ok(successorCookie);
  assert.notEqual(successorCookie.split(';', 1)[0], webLogin.refreshCookie);
  const replay = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { cookie: webLogin.refreshCookie, 'x-device-id': 'web-browser-device' },
  });
  assert.equal(replay.status, 401, 'replaying the rotated browser token must revoke the session');

  database.grantAdmin(miniProgramLogin.body.user.userId);
  const adminLogin = await login('admin-browser-device', 'admin-api');
  assert.equal(database.consumedVerificationCodeCount(), 3);
  const sessions = module.get(SessionService);
  await sessions.revoke(adminLogin.body.user.sessionId);

  const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { cookie: adminLogin.refreshCookie },
  });
  assert.equal(refreshResponse.status, 401);

  const adminResponse = await fetch(`${baseUrl}/api/admin/probe`, {
    headers: { authorization: `Bearer ${adminLogin.body.access_token}` },
  });
  assert.equal(adminResponse.status, 401);
});

test('isolates super-admin, merchant, and user audiences', async (t) => {
  const database = new StatefulAuthPersistence();
  const sms = new CapturingSmsProvider();
  const configValues: Record<string, unknown> = {
    'auth.jwtAccessSecret': 'test-access-secret-that-is-long-enough-for-the-auth-flow',
    'auth.refreshPepper': 'test-refresh-pepper-that-is-long-enough-for-the-auth-flow',
    'auth.accessTokenTtlSeconds': 900,
    'auth.refreshTokenTtlDays': 30,
    'auth.cookieSecure': false,
  };
  const config = {
    get: <T>(key: string, defaultValue?: T) => (configValues[key] ?? defaultValue) as T,
    getOrThrow: <T>(key: string) => {
      const value = configValues[key];
      if (value === undefined) throw new Error(`Missing test configuration for ${key}`);
      return value as T;
    },
  } as ConfigService;
  const jwt = new JwtService({ secret: config.getOrThrow<string>('auth.jwtAccessSecret') });
  const module = await Test.createTestingModule({
    controllers: [AuthController, MobileAuthController, AdminProbeController, MerchantProbeController, UserProbeController, OrdersController, SystemLogAdminController],
    providers: [
      AuditService,
      LegalConsentService,
      VerificationService,
      AuthService,
      PasswordService,
      AccountAuthService,
      { provide: ProfileService, useValue: { setNickname: async () => ({ nickname: 'test' }) } },
      SessionService,
      AccessTokenGuard,
      AdminGuard,
      MerchantGuard,
      SuperAdminGuard,
      MerchantStoreScope,
      { provide: OrdersService, useValue: { createOrder: async (_body: unknown, userId: string, source: string) => ({ userId, source }) } },
      { provide: SystemLogService, useValue: { find: async (id: string) => ({ id }) } },
      {
        provide: StoreContextResolver,
        useValue: {
          resolveStoreIds: (storeIds?: string[]) => {
            if (!storeIds?.includes('store-fixture')) {
              throw new Error('Store access is outside the configured store');
            }
            return ['store-fixture'];
          },
        },
      },
      UserApiGuard,
      { provide: PrismaService, useValue: database },
      { provide: SMS_PROVIDER, useValue: sms },
      { provide: OAuthService, useValue: {} },
      { provide: JwtService, useValue: jwt },
      { provide: AUTH_REFRESH_PEPPER, useValue: config.getOrThrow<string>('auth.refreshPepper') },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();
  const accountAuth = module.get(AccountAuthService);
  const originalAccountLogin = accountAuth.login.bind(accountAuth);
  let accountLoginCalls = 0;
  accountAuth.login = async (...args) => {
    accountLoginCalls += 1;
    return originalAccountLogin(...args);
  };
  database.addAccount({
    username: 'super-admin-fixture',
    passwordHash: fixturePasswordHash('bootpass'),
    roles: [{ role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeId: '' }],
  });
  database.addAccount({
    username: 'merchant-fixture',
    passwordHash: fixturePasswordHash('boot-pass'),
    roles: [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-fixture' }],
  });

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0);
  t.after(async () => app.close());
  const baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;

  const userCodeResponse = await fetch(`${baseUrl}/api/auth/codes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ purpose: 'PHONE_LOGIN', phone: '13800001000', deviceId: 'user-api-device' }),
  });
  assert.equal(userCodeResponse.status, 201);
  const userLogin = await fetch(`${baseUrl}/api/auth/phone/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': 'user-api-device' },
    body: JSON.stringify({
      phone: '13800001000',
      code: sms.latestCode(),
      audience: 'user-api',
      legalConsent: currentConsent,
    }),
  });
  assert.equal(userLogin.status, 201);
  const userTokens = await userLogin.json() as { access_token: string; user: { audience: string } };
  assert.equal(userTokens.user.audience, 'user-api');

  const loginAccount = async (username: string, password: string, audience: 'admin-api' | 'merchant-api') => {
    const response = await fetch(`${baseUrl}/api/auth/account/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-device-id': `${audience}-device` },
      body: JSON.stringify({ username, password, audience }),
    });
    return { response, body: await response.json() as { access_token?: string; user?: { audience: string } } };
  };

  const administrator = await loginAccount('super-admin-fixture', 'bootpass', 'admin-api');
  assert.equal(administrator.response.status, 201);
  assert.equal(administrator.body.user?.audience, 'admin-api');

  const merchant = await loginAccount('merchant-fixture', 'boot-pass', 'merchant-api');
  assert.equal(merchant.response.status, 201);
  assert.equal(merchant.body.user?.audience, 'merchant-api');

  const crossAudience = await loginAccount('merchant-fixture', 'boot-pass', 'admin-api');
  assert.equal(crossAudience.response.status, 401);
  assert.equal(crossAudience.body.user, undefined);

  const callsBeforeInvalidPassword = accountLoginCalls;
  const invalidPassword = await loginAccount('super-admin-fixture', 'short7!', 'admin-api');
  assert.equal(invalidPassword.response.status, 400);
  assert.equal(accountLoginCalls, callsBeforeInvalidPassword);

  const probe = async (path: string, accessToken: string | undefined) => fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert.ok(administrator.body.access_token);
  assert.ok(merchant.body.access_token);
  assert.equal((await probe('/api/admin/probe', administrator.body.access_token)).status, 200);
  assert.equal((await probe('/api/merchant/probe', merchant.body.access_token)).status, 200);
  assert.equal((await probe('/api/user/probe', userTokens.access_token)).status, 200);
  assert.equal((await probe('/api/merchant/probe/store-fixture', merchant.body.access_token)).status, 200);
  assert.equal((await probe('/api/merchant/probe/store-not-assigned', merchant.body.access_token)).status, 403);
  assert.equal((await probe('/api/admin/probe', merchant.body.access_token)).status, 403);
  assert.equal((await probe('/api/merchant/probe', administrator.body.access_token)).status, 403);
  assert.equal((await probe('/api/admin/probe', userTokens.access_token)).status, 403);
  assert.equal((await probe('/api/merchant/probe', userTokens.access_token)).status, 403);
  assert.equal((await probe('/api/user/probe', administrator.body.access_token)).status, 403);
  assert.equal((await probe('/api/user/probe', merchant.body.access_token)).status, 403);

  await t.test('mobile login and role switches bind the account, audience, store, and installation', async () => {
    const deviceId = '31c4aeca-f45a-45b8-bf3a-1132ff8ed271';
    const otherDevice = '58f16886-f8f4-462f-93f5-07d7ef8739e2';
    const phone = '13800010001';
    const account = { username: 'mobile-role-fixture', password: 'mobile-passphrase' };
    database.addAccount({
      username: account.username,
      passwordHash: fixturePasswordHash(account.password),
      phoneE164: `+86${phone}`,
      roles: [
        { role: 'USER', scopeType: 'GLOBAL', scopeId: '' },
        { role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-fixture' },
        { role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeId: '' },
      ],
    });
    const send = (path: string, body: object, token?: string, installation = deviceId) =>
      fetch(`${baseUrl}/api/auth/${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': installation,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    const readTokens = async (response: Response, status = 201) => {
      assert.equal(response.status, status);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('set-cookie'), null);
      const tokens = await response.json() as { access_token: string; refresh_token: string; user: AuthenticatedUser };
      assert.match(tokens.refresh_token, /^[A-Za-z0-9_-]{43}$/);
      return tokens;
    };

    const accountLoginPath = 'mobile/account/login';
    const merchantOnly = { username: 'mobile-merchant-fixture', password: 'mobile-passphrase' };
    database.addAccount({
      username: merchantOnly.username,
      passwordHash: fixturePasswordHash(merchantOnly.password),
      roles: [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-fixture' }],
    });
    const directMerchant = await readTokens(await send(accountLoginPath, merchantOnly));
    assert.equal(directMerchant.user.audience, 'merchant-api');
    assert.deepEqual(directMerchant.user.merchantStoreIds, ['store-fixture']);

    const adminOnly = { username: 'super-admin-fixture', password: 'bootpass' };
    const directAdmin = await readTokens(await send(accountLoginPath, adminOnly));
    assert.equal(directAdmin.user.audience, 'admin-api');

    const rejected = await send(accountLoginPath, { ...account, password: 'incorrect-passphrase' });
    assert.equal(rejected.status, 401);
    assert.equal('audiences' in await rejected.json(), false);

    const choices = await send(accountLoginPath, account);
    assert.equal(choices.status, 201);
    assert.equal(choices.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await choices.json(), { audiences: ['merchant-api', 'admin-api'] });
    const chosen = await readTokens(await send(accountLoginPath, { ...account, audience: 'merchant-api' }));
    assert.equal(chosen.user.audience, 'merchant-api');
    assert.equal((await send(accountLoginPath, { ...merchantOnly, audience: 'admin-api' })).status, 401);

    assert.equal((await send('codes', { purpose: 'PHONE_LOGIN', phone, deviceId })).status, 201);
    const challenge = { phone, code: sms.latestCode(), audience: 'user-api' };
    assert.equal((await send('mobile/phone/login', { ...challenge, legalConsent: currentConsent })).status, 400);
    const mobileConsent = {
      userAgreementVersion: MOBILE_LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT,
      privacyPolicyVersion: MOBILE_LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY,
    };
    const customer = await readTokens(await send('mobile/phone/login', { ...challenge, legalConsent: mobileConsent }));
    assert.equal(customer.user.audience, 'user-api');
    assert.equal((await send('mobile/account/switch', { ...account, audience: 'merchant-api' })).status, 401);
    assert.equal((await send('mobile/account/switch', {
      username: 'super-admin-fixture', password: 'bootpass', audience: 'admin-api',
    }, customer.access_token)).status, 401);

    const merchantSession = await readTokens(await send('mobile/account/switch', { ...account, audience: 'merchant-api' }, customer.access_token));
    const adminSession = await readTokens(await send('mobile/account/switch', { ...account, audience: 'admin-api' }, merchantSession.access_token));
    assert.equal(merchantSession.user.userId, customer.user.userId);
    assert.equal(adminSession.user.userId, customer.user.userId);
    assert.equal(new Set([customer.user.sessionId, merchantSession.user.sessionId, adminSession.user.sessionId]).size, 3);
    assert.deepEqual(merchantSession.user.merchantStoreIds, ['store-fixture']);
    assert.equal((await probe('/api/admin/probe', merchantSession.access_token)).status, 403);
    assert.equal((await probe('/api/admin/probe', adminSession.access_token)).status, 200);
    assert.equal((await probe('/api/merchant/probe/store-fixture', merchantSession.access_token)).status, 200);

    const checkout = (token: string) => fetch(`${baseUrl}/api/mobile/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderType: 'pickup', items: [{ sku_id: 'sku-1', quantity: 1 }], orderSource: 'MANUAL' }),
    });
    assert.equal((await checkout(merchantSession.access_token)).status, 403);
    const appOrder = await checkout(customer.access_token);
    assert.equal(appOrder.status, 201);
    assert.deepEqual(await appOrder.json(), { userId: customer.user.userId, source: 'APP' });

    const logPath = '/api/admin/system-logs/incident-1';
    assert.equal((await probe(logPath, merchantSession.access_token)).status, 403);
    const incident = await probe(logPath, adminSession.access_token);
    assert.equal(incident.status, 200);
    assert.deepEqual(await incident.json(), { id: 'incident-1' });

    const renewal = { refreshToken: adminSession.refresh_token };
    assert.equal((await send('mobile/refresh', renewal, undefined, otherDevice)).status, 401);
    const rotated = await readTokens(await send('mobile/refresh', renewal), 200);
    assert.equal(rotated.user.sessionId, adminSession.user.sessionId);
    assert.notEqual(rotated.refresh_token, adminSession.refresh_token);
    assert.equal((await send('mobile/refresh', renewal)).status, 401);
    assert.equal((await probe('/api/admin/probe', rotated.access_token)).status, 401);
    assert.equal((await probe('/api/user/probe', customer.access_token)).status, 200);
  });
});
