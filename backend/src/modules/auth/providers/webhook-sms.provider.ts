import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SmsProvider } from './sms-provider';

@Injectable()
export class WebhookSmsProvider implements SmsProvider {
  async send(input: { phoneE164: string; code: string }): Promise<{ messageId: string }> {
    const url = process.env.SMS_WEBHOOK_URL;
    const token = process.env.SMS_WEBHOOK_TOKEN;
    if (!url || !token) throw new Error('SMS webhook credentials are not configured.');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`SMS webhook failed with status ${response.status}.`);
    const body = await response.json().catch(() => ({})) as { messageId?: unknown };
    return { messageId: typeof body.messageId === 'string' && body.messageId ? body.messageId : randomUUID() };
  }
}
