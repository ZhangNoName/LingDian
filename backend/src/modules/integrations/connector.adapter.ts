import { createHmac } from 'node:crypto';
import type { IntegrationProvider, OrderCreatedIntegrationEvent } from '@lingdian/contracts';
import type { ConnectorSettings } from './integration.config';

export interface IntegrationAdapter {
  readonly provider: IntegrationProvider;
  deliver(event: OrderCreatedIntegrationEvent): Promise<void>;
}

type Fetcher = typeof fetch;

/**
 * Protocol-neutral connector adapter. The remote connector owns vendor SDKs,
 * certificates and protocol churn; the ordering core only emits a versioned,
 * HMAC-authenticated event. Replacing a vendor therefore replaces one connector,
 * not the order domain.
 */
export class SignedConnectorAdapter implements IntegrationAdapter {
  readonly provider: IntegrationProvider;

  constructor(
    private readonly settings: ConnectorSettings,
    private readonly fetcher: Fetcher = fetch,
  ) {
    if (!settings.endpoint || !settings.signingSecret) {
      throw new Error(`Connector ${settings.provider} is not configured`);
    }
    this.provider = settings.provider;
  }

  async deliver(event: OrderCreatedIntegrationEvent): Promise<void> {
    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', this.settings.signingSecret as string)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    const response = await this.fetcher(this.settings.endpoint as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LingDian-Event-Id': event.event_id,
        'X-LingDian-Provider': this.provider,
        'X-LingDian-Timestamp': timestamp,
        'X-LingDian-Signature': `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // Never persist a third-party response body: it can contain credentials or PII.
      throw new Error(`Connector returned HTTP ${response.status}`);
    }
  }
}
