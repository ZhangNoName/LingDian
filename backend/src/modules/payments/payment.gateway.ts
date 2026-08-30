import { BadGatewayException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type PaymentAccountConfig = {
  provider: string;
  externalAccountId: string;
  connectorConfigKey: string;
};

export type CreateGatewayIntent = {
  paymentNo: string;
  orderNo: string;
  amountMinor: number;
  currency: string;
  expiresAt: Date;
};

export type GatewayIntentResult = {
  providerIntentId: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED';
  accountExternalId: string;
  amountMinor: number;
  currency: string;
  clientAction: Record<string, unknown> | null;
};

export type CloseGatewayIntent = {
  paymentNo: string;
  providerIntentId: string | null;
  reason: 'EXPIRED';
};

export type GatewayCloseResult = {
  paymentNo: string;
  providerIntentId: string | null;
  accountExternalId: string;
  status: 'CLOSED' | 'PROCESSING' | 'SUCCEEDED' | 'UNKNOWN';
  closureId: string | null;
};

export type PaymentWebhookPayload = {
  event_id: string;
  event_type: 'PAYMENT_SUCCEEDED' | 'PAYMENT_PROCESSING' | 'PAYMENT_FAILED';
  payment_no: string;
  provider_intent_id: string;
  provider_transaction_id?: string;
  account_external_id: string;
  amount_minor: number;
  currency: string;
  occurred_at: string;
  failure_code?: string;
};

type Fetcher = typeof fetch;

export class SignedPaymentGateway {
  constructor(
    private readonly account: PaymentAccountConfig,
    private readonly endpoint: string,
    private readonly secret: string,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  async createIntent(input: CreateGatewayIntent): Promise<GatewayIntentResult> {
    const body = JSON.stringify({
      payment_no: input.paymentNo,
      order_no: input.orderNo,
      provider: this.account.provider,
      account_external_id: this.account.externalAccountId,
      amount_minor: input.amountMinor,
      currency: input.currency,
      expires_at: input.expiresAt.toISOString(),
    });
    const headers = this.sign(body);
    const response = await this.fetcher(new URL('/v1/payment-intents', this.endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new BadGatewayException(`Payment connector returned HTTP ${response.status}`);
    const result = await response.json() as GatewayIntentResult;
    if (!result?.providerIntentId || !['PENDING', 'PROCESSING', 'SUCCEEDED'].includes(result.status)) {
      throw new BadGatewayException('Payment connector returned an invalid response');
    }
    return result;
  }

  /**
   * Connector contract for fail-safe expiry recovery:
   *
   * - the operation is idempotent and serialized with create by payment_no;
   * - provider_intent_id may be null when create reached the connector but its
   *   response never reached this service;
   * - CLOSED means the connector has durably tombstoned payment_no and proved
   *   that no provider success exists or can occur later;
   * - every other status is non-terminal and must keep the local intent active.
   */
  async closeIntent(input: CloseGatewayIntent): Promise<GatewayCloseResult> {
    const body = JSON.stringify({
      payment_no: input.paymentNo,
      provider_intent_id: input.providerIntentId,
      provider: this.account.provider,
      account_external_id: this.account.externalAccountId,
      reason: input.reason,
    });
    const headers = this.sign(body);
    const response = await this.fetcher(new URL('/v1/payment-intents/close', this.endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new BadGatewayException(`Payment connector returned HTTP ${response.status}`);
    const result = await response.json() as GatewayCloseResult;
    const validProviderIntentId = result?.providerIntentId === null ||
      (typeof result?.providerIntentId === 'string' && result.providerIntentId.length > 0);
    const validClosureId = result?.closureId === null ||
      (typeof result?.closureId === 'string' && result.closureId.length > 0);
    if (
      typeof result?.paymentNo !== 'string' || !result.paymentNo ||
      typeof result.accountExternalId !== 'string' || !result.accountExternalId ||
      !validProviderIntentId ||
      !validClosureId ||
      !['CLOSED', 'PROCESSING', 'SUCCEEDED', 'UNKNOWN'].includes(result.status) ||
      (result.status === 'CLOSED' && typeof result.closureId !== 'string')
    ) {
      throw new BadGatewayException('Payment connector returned an invalid close response');
    }
    return result;
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): PaymentWebhookPayload {
    const timestamp = first(headers['x-lingdian-timestamp']);
    const nonce = first(headers['x-lingdian-nonce']);
    const signature = first(headers['x-lingdian-signature'])?.replace(/^sha256=/, '');
    if (!timestamp || !nonce || !signature || !/^\d{10}$/.test(timestamp)) {
      throw new UnauthorizedException('Invalid payment webhook signature');
    }
    if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) {
      throw new UnauthorizedException('Expired payment webhook signature');
    }
    const expected = createHmac('sha256', this.secret)
      .update(`${timestamp}.${nonce}.`)
      .update(rawBody)
      .digest('hex');
    const actualBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid payment webhook signature');
    }
    try {
      return JSON.parse(rawBody.toString('utf8')) as PaymentWebhookPayload;
    } catch {
      throw new UnauthorizedException('Invalid payment webhook body');
    }
  }

  private sign(body: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString('hex');
    const signature = createHmac('sha256', this.secret)
      .update(`${timestamp}.${nonce}.${body}`)
      .digest('hex');
    return {
      'X-LingDian-Timestamp': timestamp,
      'X-LingDian-Nonce': nonce,
      'X-LingDian-Signature': `sha256=${signature}`,
    };
  }
}

@Injectable()
export class PaymentGatewayFactory {
  create(account: PaymentAccountConfig): SignedPaymentGateway {
    const prefix = `PAYMENT_CONNECTOR_${account.connectorConfigKey}`;
    const endpoint = process.env[`${prefix}_URL`];
    const secret = process.env[`${prefix}_SECRET`];
    if (!endpoint || !secret || secret.length < 32) {
      throw new BadGatewayException(`Payment connector ${account.connectorConfigKey} is not configured`);
    }
    return new SignedPaymentGateway(account, endpoint, secret);
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
