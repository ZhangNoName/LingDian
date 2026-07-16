import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { QqOAuthProvider } from './qq-oauth.provider';
import { WechatOAuthProvider } from './wechat-oauth.provider';

function config(values: Record<string, string>) {
  return { getOrThrow: <T>(key: string) => values[key] as T } as never;
}

test('WeChat mini-program adapter exchanges uni.login code using mini-program credentials', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ openid: 'wx-openid', unionid: 'wx-unionid' }), { status: 200 });
  }) as typeof fetch;

  try {
    const provider = new WechatOAuthProvider(config({
      'auth.oauth.wechat.appId': 'web-wechat',
      'auth.oauth.wechat.appSecret': 'web-secret',
      'auth.oauth.wechat.redirectUri': 'https://web.example/callback',
      'auth.oauth.wechatMini.appId': 'mini-wechat',
      'auth.oauth.wechatMini.appSecret': 'mini-secret',
    }));

    const profile = await (provider as any).exchangeMiniProgramCode({ code: 'uni-login-code' });

    assert.match(requestedUrl, /api\.weixin\.qq\.com\/sns\/jscode2session/);
    assert.match(requestedUrl, /appid=mini-wechat/);
    assert.match(requestedUrl, /secret=mini-secret/);
    assert.match(requestedUrl, /js_code=uni-login-code/);
    assert.deepEqual(profile, { openId: 'wx-openid', unionId: 'wx-unionid' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('QQ mini-program adapter exchanges uni.login code using QQ mini-program credentials', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ openid: 'qq-openid', unionid: 'qq-unionid' }), { status: 200 });
  }) as typeof fetch;

  try {
    const provider = new QqOAuthProvider(config({
      'auth.oauth.qq.appId': 'web-qq',
      'auth.oauth.qq.appKey': 'web-key',
      'auth.oauth.qq.redirectUri': 'https://web.example/callback',
      'auth.oauth.qqMini.appId': 'mini-qq',
      'auth.oauth.qqMini.appSecret': 'mini-secret',
    }));

    const profile = await (provider as any).exchangeMiniProgramCode({ code: 'uni-login-code' });

    assert.match(requestedUrl, /api\.q\.qq\.com\/sns\/jscode2session/);
    assert.match(requestedUrl, /appid=mini-qq/);
    assert.match(requestedUrl, /secret=mini-secret/);
    assert.match(requestedUrl, /js_code=uni-login-code/);
    assert.deepEqual(profile, { openId: 'qq-openid', unionId: 'qq-unionid' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
