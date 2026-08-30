import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { SignedPaymentGateway } from './payment.gateway';

const account = { provider: 'WECHAT_PAY', externalAccountId: 'merchant-1', connectorConfigKey: 'STORE_1_WECHAT' };
const secret = 'a-secure-test-secret-with-at-least-32-characters';

test('payment gateway signs recipient and amount on create', async () => {
  let capturedBody = '';
  let capturedHeaders: HeadersInit | undefined;
  const gateway = new SignedPaymentGateway(account, 'https://connector.example', secret, async (_url, init) => {
    capturedBody = String(init?.body);
    capturedHeaders = init?.headers;
    return new Response(JSON.stringify({
      providerIntentId: 'wx-intent-1', status: 'PENDING', accountExternalId: 'merchant-1',
      amountMinor: 1880, currency: 'CNY', clientAction: { prepayId: 'redacted' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  await gateway.createIntent({ paymentNo: 'PAY1', orderNo: 'LD1', amountMinor: 1880, currency: 'CNY', expiresAt: new Date('2026-08-29T10:00:00Z') });
  const payload = JSON.parse(capturedBody);
  assert.equal(payload.account_external_id, 'merchant-1');
  assert.equal(payload.amount_minor, 1880);
  assert.ok((capturedHeaders as Record<string, string>)['X-LingDian-Signature'].startsWith('sha256='));
});

test('payment webhook requires an untampered body and a fresh signature', () => {
  const now = Math.floor(Date.now() / 1000).toString();
  const nonce = 'nonce-1';
  const rawBody = Buffer.from(JSON.stringify({ event_id: 'evt-1', event_type: 'PAYMENT_SUCCEEDED' }));
  const signature = createHmac('sha256', secret).update(`${now}.${nonce}.`).update(rawBody).digest('hex');
  const gateway = new SignedPaymentGateway(account, 'https://connector.example', secret);
  const result = gateway.verifyWebhook(rawBody, {
    'x-lingdian-timestamp': now, 'x-lingdian-nonce': nonce, 'x-lingdian-signature': `sha256=${signature}`,
  });
  assert.equal(result.event_id, 'evt-1');
  assert.throws(() => gateway.verifyWebhook(Buffer.from('{}'), {
    'x-lingdian-timestamp': now, 'x-lingdian-nonce': nonce, 'x-lingdian-signature': `sha256=${signature}`,
  }), /signature/i);
});

test('payment gateway rejects a terminal synchronous status', async () => {
  const gateway = new SignedPaymentGateway(account, 'https://connector.example', secret, async () =>
    new Response(JSON.stringify({
      providerIntentId: 'wx-intent-failed', status: 'FAILED', accountExternalId: 'merchant-1',
      amountMinor: 1880, currency: 'CNY', clientAction: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  );

  await assert.rejects(
    () => gateway.createIntent({
      paymentNo: 'PAY-FAILED', orderNo: 'LD1', amountMinor: 1880, currency: 'CNY',
      expiresAt: new Date('2026-08-29T10:00:00Z'),
    }),
    /invalid response/i,
  );
});

test('payment gateway closes an unknown provider attempt by stable payment number', async () => {
  let requestedUrl = '';
  let requestedBody = '';
  let requestedHeaders: HeadersInit | undefined;
  const gateway = new SignedPaymentGateway(
    account,
    'https://connector.example',
    secret,
    async (url, init) => {
      requestedUrl = String(url);
      requestedBody = String(init?.body);
      requestedHeaders = init?.headers;
      return new Response(JSON.stringify({
        paymentNo: 'PAY-UNKNOWN-CREATE',
        providerIntentId: null,
        accountExternalId: 'merchant-1',
        status: 'CLOSED',
        closureId: 'close-1',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  );

  const result = await gateway.closeIntent({
    paymentNo: 'PAY-UNKNOWN-CREATE',
    providerIntentId: null,
    reason: 'EXPIRED',
  });

  assert.equal(new URL(requestedUrl).pathname, '/v1/payment-intents/close');
  assert.deepEqual(JSON.parse(requestedBody), {
    payment_no: 'PAY-UNKNOWN-CREATE',
    provider_intent_id: null,
    provider: 'WECHAT_PAY',
    account_external_id: 'merchant-1',
    reason: 'EXPIRED',
  });
  assert.ok((requestedHeaders as Record<string, string>)['X-LingDian-Signature'].startsWith('sha256='));
  assert.equal(result.status, 'CLOSED');
  assert.equal(result.closureId, 'close-1');
});

test('payment gateway rejects CLOSED without a durable closure receipt', async () => {
  const gateway = new SignedPaymentGateway(account, 'https://connector.example', secret, async () =>
    new Response(JSON.stringify({
      paymentNo: 'PAY1', providerIntentId: 'wx-1', accountExternalId: 'merchant-1',
      status: 'CLOSED', closureId: null,
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  );

  await assert.rejects(
    () => gateway.closeIntent({ paymentNo: 'PAY1', providerIntentId: 'wx-1', reason: 'EXPIRED' }),
    /invalid close response/i,
  );
});

test('payment gateway rejects a non-string closure receipt', async () => {
  const gateway = new SignedPaymentGateway(account, 'https://connector.example', secret, async () =>
    new Response(JSON.stringify({
      paymentNo: 'PAY1', providerIntentId: 'wx-1', accountExternalId: 'merchant-1',
      status: 'CLOSED', closureId: { id: 'not-a-stable-scalar' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  );

  await assert.rejects(
    () => gateway.closeIntent({ paymentNo: 'PAY1', providerIntentId: 'wx-1', reason: 'EXPIRED' }),
    /invalid close response/i,
  );
});
