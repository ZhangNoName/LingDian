import { strict as assert } from 'node:assert';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { test } from 'node:test';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { createValidationException } from '../../common/exceptions/validation.exception';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { AccountAuthService } from './account-auth.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { ProfileService } from './profile.service';
import { SessionService } from './session.service';
import { VerificationService } from './verification.service';

const currentConsent = {
  userAgreementVersion: '2026-08-17',
  privacyPolicyVersion: '2026-08-17',
};

type ErrorEnvelope = { code: number; msg: string; data: unknown };

test('consumer login DTO failures expose the stable legal-consent HTTP contract before auth dependencies run', async (t) => {
  const calls = { phone: 0, wechat: 0, pendingOauth: 0 };
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: VerificationService, useValue: {} },
      { provide: AuthService, useValue: { phoneLogin: async () => { calls.phone += 1; } } },
      { provide: SessionService, useValue: {} },
      {
        provide: OAuthService,
        useValue: {
          miniProgramPhoneLogin: async () => { calls.wechat += 1; },
          linkPhone: async () => { calls.pendingOauth += 1; },
        },
      },
      { provide: ConfigService, useValue: { getOrThrow: () => false } },
      { provide: AccountAuthService, useValue: {} },
      { provide: ProfileService, useValue: {} },
    ],
  })
    .overrideGuard(AccessTokenGuard).useValue({ canActivate: () => true })
    .overrideGuard(MerchantGuard).useValue({ canActivate: () => true })
    .overrideGuard(UserApiGuard).useValue({ canActivate: () => true })
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    exceptionFactory: createValidationException,
  }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  t.after(async () => app.close());

  const address = app.getHttpServer().address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/auth`;
  const cases = [
    {
      name: 'old phone client omits legal consent',
      path: '/phone/login',
      body: { phone: '13800000000', code: '123456', audience: 'user-api' },
    },
    {
      name: 'WeChat quick login submits a stale privacy-policy version',
      path: '/wechat/miniapp/phone-login',
      body: {
        loginCode: 'login-code',
        phoneCode: 'phone-code',
        audience: 'user-api',
        legalConsent: { ...currentConsent, privacyPolicyVersion: 'stale' },
      },
    },
    {
      name: 'old pending-OAuth client omits legal consent',
      path: '/oauth/link-phone',
      body: { pendingOauthId: 'pending-1', phone: '13800000000', code: '123456' },
    },
  ];

  for (const scenario of cases) {
    const response = await fetch(`${baseUrl}${scenario.path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-device-id': 'miniapp' },
      body: JSON.stringify(scenario.body),
    });
    const body = await response.json() as ErrorEnvelope;

    assert.equal(response.status, 400, scenario.name);
    assert.deepEqual(body, {
      code: 2004,
      msg: '请更新小程序后重试',
      data: null,
    }, scenario.name);
  }

  assert.deepEqual(calls, { phone: 0, wechat: 0, pendingOauth: 0 });
});
