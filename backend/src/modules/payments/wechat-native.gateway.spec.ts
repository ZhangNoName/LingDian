import { strict as assert } from 'node:assert';
import { createCipheriv, generateKeyPairSync, sign, verify } from 'node:crypto';
import { test } from 'node:test';
import { WechatNativeGateway } from './wechat-native.gateway';

const merchant = generateKeyPairSync('rsa', { modulusLength: 2048 });
const provider = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = { id: 'account-test', provider: 'WECHAT_PAY', externalAccountId: '1234567890', connectorConfigKey: 'TEST' };
const config = {
  appId: 'wx0123456789abcdef',
  merchantSerial: 'A1B2C3',
  merchantPrivateKey: merchant.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  publicKeyId: 'PUB_KEY_ID_5000000000000000000',
  publicKey: provider.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  apiV3Key: Buffer.alloc(32, 42),
  notifyOrigin: 'https://payments.test.invalid',
};
const paymentNo = 'WXN' + 'A'.repeat(28);
const code = 'weixin://wxpay/bizpayurl/up?pr=synthetic';
const expiry = new Date('2026-11-30T12:00:00.000Z');
const order = {
  mchid: account.externalAccountId,
  appid: config.appId,
  out_trade_no: paymentNo,
};
const receipt = {
  ...order,
  trade_type: 'NATIVE',
  trade_state: 'SUCCESS',
  success_time: '2026-11-30T11:58:00+00:00',
  transaction_id: 'provider-transaction',
  amount: { total: 1002, currency: 'CNY' },
};

function signedHeaders(body: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = 'provider-nonce';
  return {
    'wechatpay-serial': config.publicKeyId,
    'wechatpay-timestamp': timestamp,
    'wechatpay-nonce': nonce,
    'wechatpay-signature': sign('RSA-SHA256', Buffer.from(`${timestamp}\n${nonce}\n${body}\n`), provider.privateKey).toString('base64'),
  };
}

function signedJson(value: object) {
  const body = JSON.stringify(value);
  return new Response(body, { headers: signedHeaders(body) });
}

test('signs Native order creation and uses only an authenticated WeChat QR payload', async () => {
  const gateway = new WechatNativeGateway(account, config, async (url, request) => {
    assert.equal(url, 'https://api.mch.weixin.qq.com/v3/pay/transactions/native');
    const headers = new Headers(request?.headers);
    const auth = Object.fromEntries([...headers.get('Authorization')!.matchAll(/(\w+)="([^"]+)"/g)].map((value) => value.slice(1)));
    assert.equal(auth.mchid, account.externalAccountId);
    assert.equal(auth.serial_no, config.merchantSerial);
    const message = ['POST', '/v3/pay/transactions/native', auth.timestamp, auth.nonce_str, request?.body, ''].join('\n');
    assert(verify('RSA-SHA256', Buffer.from(message), merchant.publicKey, Buffer.from(auth.signature, 'base64')));
    assert.deepEqual(JSON.parse(String(request?.body)), {
      ...order,
      description: '零点点餐 LD1',
      time_expire: '2026-11-30T12:00:00+00:00',
      notify_url: 'https://payments.test.invalid/api/payments/wechat-native/webhooks/account-test',
      amount: { total: 1002, currency: 'CNY' },
    });
    return signedJson({ code_url: code });
  });
  const input = { paymentNo, orderNo: 'LD1', amountMinor: 1002, currency: 'CNY', expiresAt: expiry };
  assert.deepEqual(await gateway.createIntent(input), {
    providerIntentId: paymentNo, status: 'PENDING', accountExternalId: account.externalAccountId,
    amountMinor: 1002, currency: 'CNY', clientAction: { code_url: code },
  });
  const badSignature = new WechatNativeGateway(account, config, async () => Response.json({ code_url: code }));
  await assert.rejects(badSignature.createIntent(input), /验签失败/);
});

test('checks Native receipts from signed queries and encrypted notifications', async () => {
  const gateway = new WechatNativeGateway(account, config, async () => signedJson(receipt));
  const query = await gateway.querySuccessfulPayment(paymentNo);
  assert.equal(query?.provider_transaction_id, receipt.transaction_id);
  assert.equal(query?.amount_minor, receipt.amount.total);

  const associatedData = 'transaction';
  const nonce = '123456789012';
  const cipher = createCipheriv('aes-256-gcm', config.apiV3Key, nonce);
  cipher.setAAD(Buffer.from(associatedData));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(receipt)), cipher.final(), cipher.getAuthTag()]);
  const body = JSON.stringify({
    id: 'event-1', event_type: 'TRANSACTION.SUCCESS',
    resource: { algorithm: 'AEAD_AES_256_GCM', nonce, associated_data: associatedData, ciphertext: encrypted.toString('base64') },
  });
  assert.deepEqual(gateway.verifyWebhook(Buffer.from(body), signedHeaders(body)), { ...query, event_id: 'event-1' });
  assert.throws(() => gateway.verifyWebhook(Buffer.from(body + ' '), signedHeaders(body)), /Invalid WeChat Pay signature/);
  const wrongRecipient = new WechatNativeGateway(account, config, async () => signedJson({ ...receipt, mchid: '9999999999' }));
  await assert.rejects(wrongRecipient.querySuccessfulPayment(paymentNo), /不匹配/);
});

test('requires signed close confirmation before allowing reuse, and preserves a payment that wins the close race', async () => {
  for (const state of ['CLOSED', 'SUCCESS', 'NOTPAY']) {
    let closed = false;
    const gateway = new WechatNativeGateway(account, config, async (url, request) => {
      if (request?.method === 'POST') {
        assert(String(url).endsWith('/close'));
        assert.deepEqual(JSON.parse(String(request.body)), { mchid: account.externalAccountId });
        closed = true;
        return new Response(null, { status: 204 });
      }
      return signedJson(closed && state === 'SUCCESS' ? receipt : { ...order, trade_state: closed ? state : 'NOTPAY' });
    });
    const response = await gateway.closeIntent({ paymentNo, providerIntentId: paymentNo, reason: 'EXPIRED' });
    assert.equal(response.status, state === 'CLOSED' ? 'CLOSED' : state === 'SUCCESS' ? 'SUCCEEDED' : 'UNKNOWN');
    assert.equal(Boolean(response.closureId), state === 'CLOSED');
  }
});
