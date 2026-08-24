import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { WebhookSmsProvider } from './webhook-sms.provider';

test('webhook SMS provider authenticates the request and returns the gateway message id', async () => {
  const previousUrl = process.env.SMS_WEBHOOK_URL;
  const previousToken = process.env.SMS_WEBHOOK_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.SMS_WEBHOOK_URL = 'https://sms.example.test/send';
  process.env.SMS_WEBHOOK_TOKEN = 'secret-token';
  let request: { input: string | URL | Request; init?: RequestInit } | undefined;
  globalThis.fetch = (async (input, init) => {
    request = { input, init };
    return new Response(JSON.stringify({ messageId: 'provider-message-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const result = await new WebhookSmsProvider().send({ phoneE164: '+8613800000000', code: '123456' });
    assert.deepEqual(result, { messageId: 'provider-message-1' });
    assert.equal(request?.input, 'https://sms.example.test/send');
    assert.equal(new Headers(request?.init?.headers).get('Authorization'), 'Bearer secret-token');
    assert.deepEqual(JSON.parse(String(request?.init?.body)), { phoneE164: '+8613800000000', code: '123456' });
  } finally {
    globalThis.fetch = previousFetch;
    setOrDeleteEnv('SMS_WEBHOOK_URL', previousUrl);
    setOrDeleteEnv('SMS_WEBHOOK_TOKEN', previousToken);
  }
});

function setOrDeleteEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
