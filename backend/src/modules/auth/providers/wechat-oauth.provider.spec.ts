import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { WechatOAuthProvider } from './wechat-oauth.provider';

function config(values: Record<string, string>) {
  return { getOrThrow: <T>(key: string) => values[key] as T } as never;
}

function provider() {
  return new WechatOAuthProvider(config({
    'auth.oauth.wechat.appId': 'web-wechat',
    'auth.oauth.wechat.appSecret': 'web-secret',
    'auth.oauth.wechat.redirectUri': 'https://web.example/callback',
    'auth.oauth.wechatMini.appId': 'mini-wechat',
    'auth.oauth.wechatMini.appSecret': 'mini-secret',
  }));
}

test('WeChat phone exchange reuses a live stable token and consumes each dynamic code', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body?: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    requests.push({ url, body });
    if (url.includes('/cgi-bin/stable_token')) {
      return new Response(JSON.stringify({ access_token: 'stable-token', expires_in: 7200 }), { status: 200 });
    }
    const code = body?.code;
    return new Response(JSON.stringify({ phone_info: { phoneNumber: code === 'phone-code-1' ? '13800000000' : '13900000000' } }), { status: 200 });
  }) as typeof fetch;

  try {
    const adapter = provider() as WechatOAuthProvider & {
      exchangeMiniProgramPhoneCode(input: { code: string }): Promise<{ phoneNumber: string }>;
    };

    assert.deepEqual(await adapter.exchangeMiniProgramPhoneCode({ code: 'phone-code-1' }), { phoneNumber: '13800000000' });
    assert.deepEqual(await adapter.exchangeMiniProgramPhoneCode({ code: 'phone-code-2' }), { phoneNumber: '13900000000' });
    assert.equal(requests.filter((request) => request.url.includes('/cgi-bin/stable_token')).length, 1);
    assert.deepEqual(requests[0]?.body, {
      grant_type: 'client_credential',
      appid: 'mini-wechat',
      secret: 'mini-secret',
      force_refresh: false,
    });
    assert.deepEqual(requests.slice(1).map((request) => request.body), [
      { code: 'phone-code-1' },
      { code: 'phone-code-2' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WeChat phone exchange refreshes an invalid access token once', async () => {
  const originalFetch = globalThis.fetch;
  const tokenRequests: Array<Record<string, unknown>> = [];
  let phoneAttempts = 0;
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.includes('/cgi-bin/stable_token')) {
      tokenRequests.push(body);
      return new Response(JSON.stringify({ access_token: `stable-token-${tokenRequests.length}`, expires_in: 7200 }), { status: 200 });
    }
    phoneAttempts += 1;
    if (phoneAttempts === 1) return new Response(JSON.stringify({ errcode: 40014, errmsg: 'invalid access token' }), { status: 200 });
    return new Response(JSON.stringify({ phone_info: { phoneNumber: '13800000000' } }), { status: 200 });
  }) as typeof fetch;

  try {
    const adapter = provider() as WechatOAuthProvider & {
      exchangeMiniProgramPhoneCode(input: { code: string }): Promise<{ phoneNumber: string }>;
    };
    assert.deepEqual(await adapter.exchangeMiniProgramPhoneCode({ code: 'phone-code' }), { phoneNumber: '13800000000' });
    assert.deepEqual(tokenRequests.map((body) => body.force_refresh), [false, true]);
    assert.equal(phoneAttempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WeChat phone exchange does not disclose provider errors or credentials', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    if (String(input).includes('/cgi-bin/stable_token')) {
      return new Response(JSON.stringify({ access_token: 'stable-token', expires_in: 7200 }), { status: 200 });
    }
    return new Response(JSON.stringify({ errcode: 40029, errmsg: 'secret mini-secret phone-code' }), { status: 200 });
  }) as typeof fetch;

  try {
    const adapter = provider() as WechatOAuthProvider & {
      exchangeMiniProgramPhoneCode(input: { code: string }): Promise<{ phoneNumber: string }>;
    };
    await assert.rejects(
      adapter.exchangeMiniProgramPhoneCode({ code: 'phone-code' }),
      (error: Error) => error.message === 'WeChat phone number exchange failed.' && !error.message.includes('secret'),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
