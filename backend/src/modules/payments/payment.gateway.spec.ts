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
