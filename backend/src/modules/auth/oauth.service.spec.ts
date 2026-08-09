import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { OAuthService } from './oauth.service';

function serviceWithProvider(options: {
  provider?: 'WECHAT' | 'QQ';
  appId?: string;
  miniAppId?: string;
  exchange?: () => Promise<{ openId: string; unionId?: string }>;
  pending?: any[];
} = {}) {
  const pending = options.pending ?? [];
  const audits: any[] = [];
  let nextId = 1;
  const prisma = {
    pendingOAuth: {
      create: async ({ data }: any) => {
        const record = { id: `pending-${nextId++}`, consumedAt: null, ...data };
        pending.push(record);
        return record;
      },
      findFirst: async ({ where }: any) => pending.find((record) =>
        record.provider === where.provider && record.subject === where.subject && record.stateHash === where.stateHash &&
        record.audience === where.audience && record.consumedAt === where.consumedAt && record.expiresAt > where.expiresAt.gt,
      ) ?? null,
      updateMany: async ({ data, where }: any) => {
        const record = pending.find((item) => item.id === where.id && item.consumedAt === where.consumedAt && item.expiresAt > where.expiresAt.gt);
        if (!record) return { count: 0 };
        Object.assign(record, data);
        return { count: 1 };
      },
    },
  };
  const provider = {
    provider: options.provider ?? 'WECHAT',
    appId: options.appId ?? 'wx-app',
    miniProgramAppId: options.miniAppId ?? 'mini-wx-app',
    redirectUri: 'https://client.example/oauth',
    buildAuthorizationUrl: ({ state }: { state: string }) => `https://provider.example/authorize?state=${state}`,
    exchange: options.exchange ?? (async () => ({ openId: 'openid-1', unionId: 'unionid-1' })),
    exchangeMiniProgramCode: options.exchange ?? (async () => ({ openId: 'mini-openid-1', unionId: 'mini-unionid-1' })),
  };
  return {
    pending,
    audits,
    service: new OAuthService(
      prisma as never,
      [provider] as never,
      { consume: async () => undefined } as never,
      { record: async (input: any) => { audits.push(input); } } as never,
      'test-refresh-pepper',
    ),
  };
}

test('refuses to attach a QQ subject belonging to another user', async () => {
  const oauthService = new OAuthService(
    {
      authIdentity: {
        findUnique: async () => ({ id: 'identity-1', userId: 'u1' }),
      },
    } as never,
    [] as never,
    { consume: async () => undefined } as never,
    { record: async () => undefined } as never,
  );

  await assert.rejects(
    () => oauthService.linkIdentity({ userId: 'u2', provider: 'QQ', subject: 'app:openid-1' }),
    /identity already linked/i,
  );
});

test('creates a single-use user-api state and returns only a pending binding after callback', async () => {
  const { pending, service } = serviceWithProvider();
  const started = await service.start({ provider: 'wechat', audience: 'user-api' });
  const state = new URL(started.authorizationUrl).searchParams.get('state')!;

  const callback = await service.callback({ provider: 'WECHAT', code: 'code-1', state, audience: 'user-api' });

  assert.equal(callback.expiresIn, 600);
  assert.equal(pending.find((record) => record.id === callback.pendingOauthId)?.subject, 'unionid-1');
  await assert.rejects(
    () => service.callback({ provider: 'WECHAT', code: 'code-2', state, audience: 'user-api' }),
    /state is invalid or expired/i,
  );
});

test('converts a uni.login code into a pending binding without issuing a session', async () => {
  let exchangedCode: string | undefined;
  const { pending, service } = serviceWithProvider({
    exchange: async () => ({ openId: 'ignored' }),
  });
  const provider = (service as any).providers.get('WECHAT');
  provider.exchangeMiniProgramCode = async ({ code }: { code: string }) => {
    exchangedCode = code;
    return { openId: 'mini-openid-1', unionId: 'mini-unionid-1' };
  };

  const result = await (service as any).miniProgramCallback({ provider: 'WECHAT', code: 'uni-login-code', audience: 'user-api' });

  assert.equal(exchangedCode, 'uni-login-code');
  assert.deepEqual(Object.keys(result).sort(), ['expiresIn', 'pendingOauthId']);
  assert.equal(pending.find((record) => record.id === result.pendingOauthId)?.subject, 'mini-unionid-1');
});

test('namespaces a mini-program openid with its mini-program app id when UnionID is unavailable', async () => {
  const { pending, service } = serviceWithProvider({ appId: 'web-wechat', miniAppId: 'mini-wechat' });
  const provider = (service as any).providers.get('WECHAT');
  provider.exchangeMiniProgramCode = async () => ({ openId: 'mini-openid-1' });

  const result = await (service as any).miniProgramCallback({ provider: 'WECHAT', code: 'uni-login-code', audience: 'user-api' });

  assert.equal(pending.find((record) => record.id === result.pendingOauthId)?.subject, 'mini-wechat:mini-openid-1');
});

test('uses the application-qualified openid when a WeChat unionid is unavailable', async () => {
  const { pending, service } = serviceWithProvider({ exchange: async () => ({ openId: 'openid-1' }) });
  const state = new URL((await service.start({ provider: 'WECHAT', audience: 'user-api' })).authorizationUrl).searchParams.get('state')!;

  const callback = await service.callback({ provider: 'WECHAT', code: 'code-1', state, audience: 'user-api' });

  assert.equal(pending.find((record) => record.id === callback.pendingOauthId)?.subject, 'wx-app:openid-1');
});

test('prohibits the admin audience from starting OAuth', async () => {
  const { service } = serviceWithProvider();
  await assert.rejects(() => service.start({ provider: 'WECHAT', audience: 'admin-api' }), /only available to the user API audience/i);
});

test('maps a QQ callback to an app-qualified openid without issuing a session', async () => {
  const { pending, service } = serviceWithProvider({ provider: 'QQ', appId: 'qq-app', exchange: async () => ({ openId: 'qq-openid' }) });
  const state = new URL((await service.start({ provider: 'QQ', audience: 'user-api' })).authorizationUrl).searchParams.get('state')!;
  const result = await service.callback({ provider: 'QQ', code: 'code', state, audience: 'user-api' });

  assert.deepEqual(Object.keys(result).sort(), ['expiresIn', 'pendingOauthId']);
  assert.equal(pending.find((record) => record.id === result.pendingOauthId)?.subject, 'qq-app:qq-openid');
});

test('audits rejected provider, audience, and phone-normalization paths', async () => {
  const { audits, service } = serviceWithProvider();
  await assert.rejects(() => service.start({ provider: 'missing', audience: 'user-api' }), /unsupported/i);
  await assert.rejects(() => service.callback({ provider: 'WECHAT', code: 'c', state: 'state-state-state', audience: 'admin-api' }), /only available/i);
  await assert.rejects(() => service.linkPhone({ pendingOauthId: 'p', phone: 'bad', code: '123456' }), /mainland Chinese mobile/i);

  assert.deepEqual(audits.map((audit) => audit.event), ['OAUTH_START_REJECTED', 'OAUTH_CALLBACK_REJECTED', 'OAUTH_PHONE_LINK_REJECTED']);
});

test('does not burn a PHONE_LINK code when its serializable attachment transaction fails', async () => {
  let consumes = 0;
  const service = new OAuthService(
    { $transaction: async () => { throw new Error('attachment failed'); } } as never,
    [] as never,
    { consume: async () => { consumes += 1; } } as never,
    { record: async () => undefined } as never,
  );

  await assert.rejects(
    () => service.linkPhone({ pendingOauthId: 'pending-1', phone: '13800000000', code: '123456' }),
    /attachment failed/i,
  );
  assert.equal(consumes, 0);
});

test('retries a P2034 race before consuming a PHONE_LINK code and attaching the pending identity', async () => {
  const pending = { id: 'pending-1', provider: 'QQ', subject: 'qq:openid', consumedAt: null, expiresAt: new Date(Date.now() + 60_000) };
  const user = { id: 'user-1', status: 'ACTIVE' as const, sessionVersion: 1, roles: [{ role: 'USER' as const, status: 'ACTIVE' as const }] };
  let attempts = 0;
  let consumes = 0;
  const tx = {
    pendingOAuth: {
      findFirst: async () => pending,
      updateMany: async () => ({ count: 1 }),
    },
    authIdentity: {
      findUnique: async ({ where }: any) => where.provider_subject.provider === 'PHONE'
        ? { userId: user.id, user }
        : { userId: user.id },
      create: async () => undefined,
    },
  };
  const service = new OAuthService(
    {
      $transaction: async (callback: any) => {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error('write conflict'), { code: 'P2034' });
        return callback(tx);
      },
    } as never,
    [] as never,
    { consume: async (_input: unknown, client: unknown) => { assert.equal(client, tx); consumes += 1; } } as never,
    { record: async () => undefined } as never,
  );

  const linked = await service.linkPhone({ pendingOauthId: pending.id, phone: '13800000000', code: '123456' });

  assert.equal(linked.id, user.id);
  assert.equal(attempts, 2);
  assert.equal(consumes, 1);
});

test('bindPendingIdentity rejects a third-party subject already owned by another user', async () => {
  const tx = {
    authIdentity: {
      findUnique: async ({ where }: any) => where.provider_subject.provider === 'PHONE'
        ? { userId: 'user-1' }
        : { userId: 'user-2' },
      create: async () => undefined,
    },
    pendingOAuth: {
      findFirst: async () => ({ id: 'pending-1', provider: 'QQ', subject: 'qq:openid', consumedAt: null, expiresAt: new Date(Date.now() + 60_000) }),
      updateMany: async () => ({ count: 1 }),
    },
  };
  const service = new OAuthService(
    { $transaction: async (callback: any) => callback(tx) } as never,
    [{ provider: 'QQ', appId: 'qq-app', redirectUri: 'https://client', buildAuthorizationUrl: () => '', exchange: async () => ({ openId: 'ignored' }) }] as never,
    { consume: async (_input: unknown, client: unknown) => assert.equal(client, tx) } as never,
    { record: async () => undefined } as never,
  );

  await assert.rejects(
    () => service.bindPendingIdentity({ userId: 'user-1', provider: 'QQ', pendingOauthId: 'pending-1', phone: '13800000000', code: '123456' }),
    /identity already linked/i,
  );
});

test('unbindIdentity requires a current users PHONE_LINK verification and retains the final PHONE identity', async () => {
  let deleted = false;
  const tx = {
    authIdentity: {
      findUnique: async ({ where }: any) => where.provider_subject
        ? { userId: 'user-1' }
        : { id: where.id, userId: 'user-1', provider: 'PHONE' },
      count: async () => 1,
      delete: async () => { deleted = true; },
    },
  };
  const service = new OAuthService(
    { $transaction: async (callback: any) => callback(tx) } as never,
    [] as never,
    { consume: async (_input: unknown, client: unknown) => assert.equal(client, tx) } as never,
    { record: async () => undefined } as never,
  );

  await assert.rejects(
    () => service.unlinkIdentity({ userId: 'user-1', identityId: 'phone-identity', phone: '13800000000', code: '123456' }),
    /final phone identity/i,
  );
  assert.equal(deleted, false);
});

test('linkPhone rejects a disabled phone user before a session can be issued', async () => {
  const tx = {
    pendingOAuth: {
      findFirst: async () => ({ id: 'pending-1', provider: 'QQ', subject: 'qq:openid', consumedAt: null, expiresAt: new Date(Date.now() + 60_000) }),
      updateMany: async () => ({ count: 1 }),
    },
    authIdentity: {
      findUnique: async () => ({
        userId: 'user-1',
        user: { id: 'user-1', status: 'DISABLED', sessionVersion: 1, roles: [{ role: 'USER', status: 'ACTIVE' }] },
      }),
    },
  };
  const service = new OAuthService(
    { $transaction: async (callback: any) => callback(tx) } as never,
    [] as never,
    { consume: async () => undefined } as never,
    { record: async () => undefined } as never,
  );

  await assert.rejects(
    () => service.linkPhone({ pendingOauthId: 'pending-1', phone: '13800000000', code: '123456' }),
    /user is inactive/i,
  );
});

test('mini-program phone login creates one phone user and binds the WeChat identity', async () => {
  const createdIdentities: any[] = [];
  const user = {
    id: 'user-1',
    status: 'ACTIVE' as const,
    sessionVersion: 1,
    roles: [{ role: 'USER' as const, status: 'ACTIVE' as const }],
  };
  const tx = {
    authIdentity: {
      findUnique: async () => null,
      create: async ({ data }: any) => { createdIdentities.push(data); return data; },
    },
    user: {
      create: async ({ data }: any) => {
        assert.deepEqual(data.identities.create, {
          provider: 'PHONE',
          subject: '+8613800000000',
          phoneE164: '+8613800000000',
          verifiedAt: data.identities.create.verifiedAt,
        });
        return user;
      },
    },
  };
  const provider = {
    provider: 'WECHAT',
    appId: 'web-wx',
    miniProgramAppId: 'mini-wx',
    redirectUri: 'https://client.example/oauth',
    buildAuthorizationUrl: () => '',
    exchange: async () => ({ openId: 'unused' }),
    exchangeMiniProgramCode: async ({ code }: { code: string }) => {
      assert.equal(code, 'login-code');
      return { openId: 'openid-1', unionId: 'unionid-1' };
    },
    exchangeMiniProgramPhoneCode: async ({ code }: { code: string }) => {
      assert.equal(code, 'phone-code');
      return { phoneNumber: '13800000000' };
    },
  };
  const service = new OAuthService(
    { $transaction: async (callback: any) => callback(tx) } as never,
    [provider] as never,
    { consume: async () => undefined } as never,
    { record: async () => undefined } as never,
  );

  const result = await (service as any).miniProgramPhoneLogin({
    loginCode: 'login-code',
    phoneCode: 'phone-code',
    audience: 'user-api',
  });

  assert.equal(result.id, 'user-1');
  assert.deepEqual(createdIdentities, [{
    userId: 'user-1',
    provider: 'WECHAT',
    subject: 'unionid-1',
    verifiedAt: createdIdentities[0]?.verifiedAt,
  }]);
});

test('mini-program phone login reuses the verified phone user', async () => {
  const user = {
    id: 'user-1',
    status: 'ACTIVE' as const,
    sessionVersion: 2,
    roles: [{ role: 'USER' as const, status: 'ACTIVE' as const }],
  };
  let userCreates = 0;
  const tx = {
    authIdentity: {
      findUnique: async ({ where }: any) => where.provider_subject.provider === 'PHONE'
        ? { userId: user.id, user }
        : null,
      create: async () => undefined,
    },
    user: { create: async () => { userCreates += 1; return user; } },
  };
  const provider = {
    provider: 'WECHAT', appId: 'web-wx', miniProgramAppId: 'mini-wx', redirectUri: 'https://client',
    buildAuthorizationUrl: () => '', exchange: async () => ({ openId: 'unused' }),
    exchangeMiniProgramCode: async () => ({ openId: 'openid-1' }),
    exchangeMiniProgramPhoneCode: async () => ({ phoneNumber: '13800000000' }),
  };
  const service = new OAuthService(
    { $transaction: async (callback: any) => callback(tx) } as never,
    [provider] as never,
    { consume: async () => undefined } as never,
    { record: async () => undefined } as never,
  );

  const result = await (service as any).miniProgramPhoneLogin({ loginCode: 'login-code', phoneCode: 'phone-code', audience: 'user-api' });

  assert.equal(result.id, user.id);
  assert.equal(userCreates, 0);
});

test('mini-program phone login rejects a WeChat identity owned by another user', async () => {
  const user = {
    id: 'user-1', status: 'ACTIVE' as const, sessionVersion: 1,
    roles: [{ role: 'USER' as const, status: 'ACTIVE' as const }],
  };
  const tx = {
    authIdentity: {
      findUnique: async ({ where }: any) => where.provider_subject.provider === 'PHONE'
        ? { userId: user.id, user }
        : { userId: 'user-2' },
      create: async () => undefined,
    },
  };
  const provider = {
    provider: 'WECHAT', appId: 'web-wx', miniProgramAppId: 'mini-wx', redirectUri: 'https://client',
    buildAuthorizationUrl: () => '', exchange: async () => ({ openId: 'unused' }),
    exchangeMiniProgramCode: async () => ({ openId: 'openid-1' }),
    exchangeMiniProgramPhoneCode: async () => ({ phoneNumber: '13800000000' }),
  };
  const service = new OAuthService(
    { $transaction: async (callback: any) => callback(tx) } as never,
    [provider] as never,
    { consume: async () => undefined } as never,
    { record: async () => undefined } as never,
  );

  await assert.rejects(
    () => (service as any).miniProgramPhoneLogin({ loginCode: 'login-code', phoneCode: 'phone-code', audience: 'user-api' }),
    /identity already linked/i,
  );
});
