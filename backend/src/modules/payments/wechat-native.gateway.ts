import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import { createDecipheriv, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import type { CloseGatewayIntent, CreateGatewayIntent, GatewayCloseResult, GatewayIntentResult, PaymentAccountConfig, PaymentWebhookPayload } from './payment.gateway';

const gatewayOrigin = 'https://api.mch.weixin.qq.com';
const maxClockSkewSeconds = 300;
export const wechatNativePaymentPrefix = 'WXN';

export function isWechatNativePayment(paymentNo: string): boolean {
  return /^WXN[A-F0-9]{28}$/.test(paymentNo);
}

type NativeAccount = PaymentAccountConfig & { id?: string };
type NativeCredentials = {
  appId: string;
  merchantSerial: string;
  merchantPrivateKey: string;
  publicKeyId: string;
  publicKey: string;
  apiV3Key: Buffer;
  notifyOrigin: string;
};

type WechatTransaction = {
  appid?: string;
  mchid?: string;
  out_trade_no?: string;
  trade_type?: string;
  trade_state?: string;
  transaction_id?: string;
  amount?: { total?: number; currency?: string };
  success_time?: string;
};

function credentials(account: NativeAccount): NativeCredentials | null {
  if (account.provider !== 'WECHAT_PAY' || !/^\d{6,32}$/.test(account.externalAccountId)) return null;
  const env = (name: string) => process.env[`WECHAT_NATIVE_${account.connectorConfigKey}_${name}`]?.trim() ?? '';
  const appId = env('APP_ID');
  const merchantSerial = env('MERCHANT_SERIAL');
  const merchantPrivateKey = env('MERCHANT_PRIVATE_KEY').replace(/\\n/g, '\n');
  const publicKeyId = env('PUBLIC_KEY_ID');
  const publicKey = env('PUBLIC_KEY').replace(/\\n/g, '\n');
  const apiV3Key = Buffer.from(env('API_V3_KEY'), 'utf8');
  const origin = env('NOTIFY_ORIGIN');
  const url = URL.parse(origin);
  if (
    !/^wx[a-fA-F0-9]{16}$/.test(appId) || !/^[A-Fa-f0-9]+$/.test(merchantSerial) ||
    !merchantPrivateKey || !/^PUB_KEY_ID_\d+$/.test(publicKeyId) || !publicKey || apiV3Key.length !== 32 ||
    !url || url.protocol !== 'https:' || url.origin !== origin.replace(/\/$/, '')
  ) return null;
  try {
    if (createPrivateKey(merchantPrivateKey).asymmetricKeyType !== 'rsa' ||
      createPublicKey(publicKey).asymmetricKeyType !== 'rsa') return null;
  } catch {
    return null;
  }
  return { appId, merchantSerial, merchantPrivateKey, publicKeyId, publicKey, apiV3Key, notifyOrigin: url.origin };
}

export class WechatNativeGateway {
  static isConfigured(account: NativeAccount): boolean {
    return credentials(account) !== null;
  }

  static forAccount(account: NativeAccount): WechatNativeGateway {
    const config = credentials(account);
    if (!config) throw new BadGatewayException('门店微信扫码支付尚未配置');
    return new WechatNativeGateway(account, config);
  }

  constructor(
    private readonly account: NativeAccount,
    private readonly config: NativeCredentials,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async createIntent(input: CreateGatewayIntent): Promise<GatewayIntentResult> {
    if (!this.account.id || !isWechatNativePayment(input.paymentNo)) {
      throw new BadGatewayException('Invalid WeChat Native payment configuration');
    }
    const response = await this.request('POST', '/v3/pay/transactions/native', {
      appid: this.config.appId,
      mchid: this.account.externalAccountId,
      description: `零点点餐 ${input.orderNo}`,
      out_trade_no: input.paymentNo,
      time_expire: input.expiresAt.toISOString().replace(/\.\d+Z$/, '+00:00'),
      notify_url: `${this.config.notifyOrigin}/api/payments/wechat-native/webhooks/${encodeURIComponent(this.account.id)}`,
      amount: { total: input.amountMinor, currency: input.currency },
    });
    const { code_url: code } = await this.readSignedJson<{ code_url?: string }>(response);
    if (typeof code !== 'string' || code.length > 512 || !/^weixin:\/\/\S+$/.test(code)) {
      throw new BadGatewayException('微信支付未返回有效的二维码');
    }
    return {
      providerIntentId: input.paymentNo,
      status: 'PENDING',
      accountExternalId: this.account.externalAccountId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      clientAction: { code_url: code },
    };
  }

  async querySuccessfulPayment(paymentNo: string): Promise<PaymentWebhookPayload | null> {
    const transaction = await this.query(paymentNo);
    if (transaction.trade_state !== 'SUCCESS') return null;
    return this.successfulPayload(transaction, `native-query-${paymentNo}`);
  }

  async closeIntent(input: CloseGatewayIntent): Promise<GatewayCloseResult> {
    const result: GatewayCloseResult = {
      paymentNo: input.paymentNo,
      providerIntentId: input.paymentNo,
      accountExternalId: this.account.externalAccountId,
      status: 'UNKNOWN',
      closureId: null,
    };
    let order = await this.query(input.paymentNo);
    if (order.trade_state === 'NOTPAY') {
      // A signed query resolves a close race, including a customer paying just before the close.
      await this.request('POST', `${this.orderPath(input.paymentNo)}/close`, { mchid: this.account.externalAccountId })
        .catch(() => undefined);
      order = await this.query(input.paymentNo);
    }
    if (order.trade_state === 'CLOSED') {
      return { ...result, status: 'CLOSED', closureId: input.paymentNo };
    }
    if (order.trade_state === 'SUCCESS') return { ...result, status: 'SUCCEEDED' };
    if (order.trade_state === 'USERPAYING') return { ...result, status: 'PROCESSING' };
    return result;
  }

  verifyWebhook(raw: Buffer, headers: Record<string, string | string[] | undefined>): PaymentWebhookPayload {
    const body = raw.toString('utf8');
    const readHeader = (name: string) => typeof headers[name] === 'string' ? headers[name] : undefined;
    if (!this.verifySignature(body, readHeader)) throw new UnauthorizedException('Invalid WeChat Pay signature');
    try {
      const { id, event_type: eventType, resource } = JSON.parse(body);
      if (typeof id !== 'string' || eventType !== 'TRANSACTION.SUCCESS' || resource?.algorithm !== 'AEAD_AES_256_GCM') {
        throw new Error('Invalid notification');
      }
      const encrypted = Buffer.from(resource.ciphertext, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', this.config.apiV3Key, resource.nonce);
      decipher.setAuthTag(encrypted.subarray(-16));
      decipher.setAAD(Buffer.from(resource.associated_data ?? '', 'utf8'));
      const plaintext = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8');
      return this.successfulPayload(JSON.parse(plaintext), id);
    } catch {
      throw new UnauthorizedException('Invalid WeChat Pay notification');
    }
  }

  private successfulPayload(transaction: WechatTransaction, eventId: string): PaymentWebhookPayload {
    const { out_trade_no: paymentNo, amount, transaction_id: transactionId, success_time: successTime } = transaction;
    if (!paymentNo || !this.isExpectedOrder(transaction, paymentNo) || transaction.trade_state !== 'SUCCESS' ||
      !transactionId || !successTime || !amount || typeof amount.total !== 'number' || amount.currency !== 'CNY') {
      throw new BadGatewayException('微信支付返回了不匹配的支付信息');
    }
    return {
      event_id: eventId,
      event_type: 'PAYMENT_SUCCEEDED',
      payment_no: paymentNo,
      provider_intent_id: paymentNo,
      provider_transaction_id: transactionId,
      account_external_id: this.account.externalAccountId,
      amount_minor: amount.total,
      currency: amount.currency,
      occurred_at: successTime,
    };
  }

  private isExpectedOrder(transaction: WechatTransaction, paymentNo: string, allowMissingType = false): boolean {
    return isWechatNativePayment(paymentNo) && transaction.out_trade_no === paymentNo &&
      transaction.appid === this.config.appId && transaction.mchid === this.account.externalAccountId &&
      (transaction.trade_type === 'NATIVE' || (allowMissingType && transaction.trade_type === undefined));
  }

  private orderPath(paymentNo: string): string {
    return `/v3/pay/transactions/out-trade-no/${encodeURIComponent(paymentNo)}`;
  }

  private async query(paymentNo: string): Promise<WechatTransaction> {
    const response = await this.request('GET', `${this.orderPath(paymentNo)}?mchid=${this.account.externalAccountId}`);
    const transaction = await this.readSignedJson<WechatTransaction>(response);
    if (!this.isExpectedOrder(transaction, paymentNo, transaction.trade_state !== 'SUCCESS')) {
      throw new BadGatewayException('微信支付返回了不匹配的订单');
    }
    return transaction;
  }

  private request(method: 'GET' | 'POST', path: string, data?: object) {
    const body = data ? JSON.stringify(data) : '';
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(16).toString('hex');
    const signature = sign('RSA-SHA256', Buffer.from(`${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`), this.config.merchantPrivateKey).toString('base64');
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${this.account.externalAccountId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${this.config.merchantSerial}",signature="${signature}"`;
    return this.fetcher(gatewayOrigin + path, {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: authorization, 'Wechatpay-Serial': this.config.publicKeyId },
      ...(body ? { body } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
  }

  private async readSignedJson<T>(response: Response): Promise<T> {
    const body = await response.text();
    if (!this.verifySignature(body, (key) => response.headers.get(key) ?? undefined)) {
      throw new BadGatewayException('微信支付响应验签失败');
    }
    if (!response.ok) throw new BadGatewayException(`微信支付请求失败（${response.status}）`);
    try {
      const value = JSON.parse(body) as T;
      if (!value || typeof value !== 'object') throw new Error('Expected object');
      return value;
    } catch {
      throw new BadGatewayException('微信支付响应异常');
    }
  }

  private verifySignature(body: string, header: (key: string) => string | undefined): boolean {
    const timestamp = header('wechatpay-timestamp');
    const nonce = header('wechatpay-nonce');
    const signature = header('wechatpay-signature');
    const serial = header('wechatpay-serial');
    if (!timestamp || !/^\d{10}$/.test(timestamp) || !nonce || !signature || serial !== this.config.publicKeyId) return false;
    if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > maxClockSkewSeconds) return false;
    return verify('RSA-SHA256', Buffer.from(`${timestamp}\n${nonce}\n${body}\n`), this.config.publicKey, Buffer.from(signature, 'base64'));
  }
}
