import { strict as assert } from 'node:assert';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { test } from 'node:test';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { AuthController } from './auth.controller';
import { AccountLoginDto } from './dto/account-login.dto';
import { CompleteOAuthLoginDto } from './dto/complete-oauth-login.dto';
import { PhoneLoginDto } from './dto/phone-login.dto';
import { WechatMiniProgramPhoneLoginDto } from './dto/wechat-mini-program-phone-login.dto';

const currentConsent = {
  userAgreementVersion: '2026-08-17',
  privacyPolicyVersion: '2026-08-17',
};

test('account login validation accepts a bootstrap-compatible nine-character password', async () => {
  const dto = plainToInstance(AccountLoginDto, {
    username: 'admin-root',
    password: 'boot-pass',
    audience: 'admin-api',
  });

  assert.deepEqual(await validate(dto), []);
});

test('nickname endpoint accepts every authenticated audience through only the access-token guard', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.updateNickname) as unknown[];
  assert.deepEqual(guards, [AccessTokenGuard]);
});

test('customer profile read and avatar upload require the user-api audience', () => {
  for (const endpoint of ['getProfile', 'uploadAvatar'] as const) {
    const handler = (AuthController.prototype as any)[endpoint];
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    assert.ok(guards.includes(AccessTokenGuard));
    assert.ok(guards.includes(UserApiGuard));
  }
});

test('customer profile endpoints use the authenticated user id', async () => {
  const calls: unknown[] = [];
  const controller = new AuthController(
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    {
      get: async (userId: string) => { calls.push(['get', userId]); return { nickname: '零点用户', avatar_data_url: null }; },
      setAvatar: async (userId: string, file: unknown) => { calls.push(['avatar', userId, file]); return { nickname: '零点用户', avatar_data_url: 'data:image/png;base64,eA==' }; },
    } as never,
  );
  const user = { userId: 'user-1' } as never;
  const file = { buffer: Buffer.from('x'), mimetype: 'image/png', size: 1 };

  assert.deepEqual(await (controller as any).getProfile(user), { nickname: '零点用户', avatar_data_url: null });
  assert.deepEqual(await (controller as any).uploadAvatar(user, file), { nickname: '零点用户', avatar_data_url: 'data:image/png;base64,eA==' });
  assert.deepEqual(calls, [['get', 'user-1'], ['avatar', 'user-1', file]]);
});

test('identity bind and unlink endpoints require the user-api audience guard', () => {
  for (const endpoint of ['bindIdentity', 'unlinkIdentity'] as const) {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype[endpoint]) as unknown[];
    assert.ok(guards.includes(AccessTokenGuard));
    assert.ok(guards.includes(UserApiGuard));
  }
});

test('password change endpoints require the merchant audience guard', () => {
  for (const endpoint of ['requestPasswordChangeCode', 'changePassword'] as const) {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype[endpoint]) as unknown[];
    assert.ok(guards.includes(AccessTokenGuard));
    assert.ok(guards.includes(MerchantGuard));
  }
});

test('mini-program callback forwards a uni.login code and returns only the pending binding', async () => {
  const calls: unknown[] = [];
  const controller = new AuthController(
    {} as never,
    {} as never,
    {} as never,
    {
      miniProgramCallback: async (input: unknown) => {
        calls.push(input);
        return { pendingOauthId: 'pending-1', expiresIn: 600 };
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const result = await controller.miniProgramOauthCallback(
    'wechat',
    { code: 'uni-login-code', audience: 'user-api' },
    { ip: '127.0.0.1', headers: { 'x-device-id': 'device-1' } },
  );

  assert.deepEqual(calls, [{ provider: 'wechat', code: 'uni-login-code', audience: 'user-api', ip: '127.0.0.1', device: 'device-1' }]);
  assert.deepEqual(result, { pending_oauth_id: 'pending-1', expires_in: 600 });
});

test('WeChat mini-program phone login DTO rejects empty or non-user credentials', async () => {
  const invalid = plainToInstance(WechatMiniProgramPhoneLoginDto, {
    loginCode: '',
    phoneCode: '',
    audience: 'admin-api',
  });
  const valid = plainToInstance(WechatMiniProgramPhoneLoginDto, {
    loginCode: 'login-code',
    phoneCode: 'phone-code',
    audience: 'user-api',
    legalConsent: currentConsent,
  });

  assert.ok((await validate(invalid)).length >= 4);
  assert.deepEqual(await validate(valid), []);
});

test('consumer login DTOs require nested current legal-consent versions while admin phone login stays exempt', async () => {
  const userPhoneMissing = plainToInstance(PhoneLoginDto, {
    phone: '13800000000', code: '123456', audience: 'user-api',
  });
  const adminPhoneMissing = plainToInstance(PhoneLoginDto, {
    phone: '13800000000', code: '123456', audience: 'admin-api',
  });
  const userPhoneCurrent = plainToInstance(PhoneLoginDto, {
    phone: '13800000000', code: '123456', audience: 'user-api', legalConsent: currentConsent,
  });
  const oauthOutdated = plainToInstance(CompleteOAuthLoginDto, {
    pendingOauthId: 'pending-1', phone: '13800000000', code: '123456',
    legalConsent: { ...currentConsent, privacyPolicyVersion: 'outdated' },
  });
  const oauthCurrent = plainToInstance(CompleteOAuthLoginDto, {
    pendingOauthId: 'pending-1', phone: '13800000000', code: '123456', legalConsent: currentConsent,
  });

  assert.ok((await validate(userPhoneMissing)).length > 0);
  assert.deepEqual(await validate(adminPhoneMissing), []);
  assert.deepEqual(await validate(userPhoneCurrent), []);
  assert.ok((await validate(oauthOutdated)).length > 0);
  assert.deepEqual(await validate(oauthCurrent), []);
});

test('WeChat mini-program phone login issues a session and refresh cookie', async () => {
  const oauthCalls: unknown[] = [];
  const cookieCalls: unknown[][] = [];
  const controller = new AuthController(
    {} as never,
    {} as never,
    {} as never,
    {
      miniProgramPhoneLogin: async (input: unknown) => {
        oauthCalls.push(input);
        return {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
          user: { userId: 'user-1', sessionId: 'session-1', audience: 'user-api', roles: ['USER'] },
        };
      },
    } as never,
    { getOrThrow: () => false } as never,
    {} as never,
    {} as never,
  );

  const result = await (controller as any).wechatMiniProgramPhoneLogin(
    { loginCode: 'login-code', phoneCode: 'phone-code', audience: 'user-api', legalConsent: currentConsent },
    { ip: '127.0.0.1', headers: { 'x-device-id': 'mini-device' } },
    { cookie: (...args: unknown[]) => cookieCalls.push(args), clearCookie: () => undefined },
  );

  assert.deepEqual(oauthCalls, [{
    loginCode: 'login-code', phoneCode: 'phone-code', audience: 'user-api',
    legalConsent: currentConsent,
    ip: '127.0.0.1', device: 'mini-device',
  }]);
  assert.equal(cookieCalls[0]?.[0], 'refresh_token');
  assert.deepEqual(result, {
    access_token: 'access-token',
    expires_in: 900,
    user: { userId: 'user-1', sessionId: 'session-1', audience: 'user-api', roles: ['USER'] },
  });
});

test('OAuth phone-link completion forwards legal consent with request context', async () => {
  const oauthCalls: unknown[] = [];
  const cookieCalls: unknown[][] = [];
  const controller = new AuthController(
    {} as never,
    {} as never,
    {} as never,
    {
      linkPhone: async (input: unknown) => {
        oauthCalls.push(input);
        return {
          accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900,
          user: { userId: 'user-1', sessionId: 'session-1', audience: 'user-api', roles: ['USER'] },
        };
      },
    } as never,
    { getOrThrow: () => false } as never,
    {} as never,
    {} as never,
  );

  const result = await controller.linkPhone(
    { pendingOauthId: 'pending-1', phone: '13800000000', code: '123456', legalConsent: currentConsent } as CompleteOAuthLoginDto,
    { ip: '127.0.0.1', headers: { 'x-device-id': 'miniapp' } },
    { cookie: (...args: unknown[]) => cookieCalls.push(args), clearCookie: () => undefined },
  );

  assert.deepEqual(oauthCalls, [{
    pendingOauthId: 'pending-1', phone: '13800000000', code: '123456', legalConsent: currentConsent,
    ip: '127.0.0.1', device: 'miniapp',
  }]);
  assert.equal(cookieCalls[0]?.[0], 'refresh_token');
  assert.deepEqual(result, {
    access_token: 'access-token',
    expires_in: 900,
    user: { userId: 'user-1', sessionId: 'session-1', audience: 'user-api', roles: ['USER'] },
  });
});

test('does not return a raw refresh credential when an HTTPS request spoofs the native-secure header', async () => {
  const cookieCalls: unknown[][] = [];
  const controller = new AuthController(
    {} as never,
    {} as never,
    {
      refresh: async (token: string) => ({
        accessToken: 'access-token', refreshToken: `${token}-successor`, expiresIn: 900,
        user: { userId: 'user-1', sessionId: 'session-1', audience: 'user-api', roles: ['USER'] },
      }),
    } as never,
    {} as never,
    { getOrThrow: () => false } as never,
    {} as never,
    {} as never,
  );

  const result = await controller.refresh(
    { refreshToken: 'attacker-supplied-refresh-token' } as never,
    { protocol: 'https', headers: { 'x-auth-client': 'native-secure', 'x-device-id': 'device-1' }, cookies: { refresh_token: 'http-only-cookie-token' } },
    { cookie: (...args: unknown[]) => { cookieCalls.push(args); }, clearCookie: () => undefined },
  );

  assert.deepEqual(result, {
    access_token: 'access-token', expires_in: 900,
    user: { userId: 'user-1', sessionId: 'session-1', audience: 'user-api', roles: ['USER'] },
  });
  assert.equal(cookieCalls.length, 1);
  assert.equal(cookieCalls[0][0], 'refresh_token');
  assert.equal(cookieCalls[0][1], 'http-only-cookie-token-successor');
  assert.equal((cookieCalls[0][2] as { httpOnly: boolean }).httpOnly, true);
});

test('account login issues the browser refresh cookie through the account authentication service', async () => {
  const cookieCalls: unknown[][] = [];
  const controller = new AuthController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { getOrThrow: () => false } as never,
    {
      login: async () => ({
        accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900,
        user: { userId: 'merchant-1', sessionId: 'session-1', audience: 'merchant-api', roles: ['MERCHANT'] },
      }),
    } as never,
    {} as never,
  );

  const result = await controller.accountLogin(
    { username: 'merchant-one', password: 'merchant-password-123', audience: 'merchant-api' },
    { ip: '127.0.0.1', headers: { 'x-device-id': 'web' } },
    { cookie: (...args: unknown[]) => { cookieCalls.push(args); }, clearCookie: () => undefined },
  );

  assert.equal(cookieCalls.length, 1);
  assert.deepEqual(result, {
    access_token: 'access-token', expires_in: 900,
    user: { userId: 'merchant-1', sessionId: 'session-1', audience: 'merchant-api', roles: ['MERCHANT'] },
  });
});
