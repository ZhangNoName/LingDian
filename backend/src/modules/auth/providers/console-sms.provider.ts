import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SMS_LOGGER, SmsLogger, SmsProvider } from './sms-provider';

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  constructor(@Inject(SMS_LOGGER) private readonly logger: SmsLogger) {}

  async send(input: { phoneE164: string; code: string }): Promise<{ messageId: string }> {
    const messageId = `console_${randomUUID()}`;

    this.logger.log(`Sent SMS to ${maskPhone(input.phoneE164)} with message id ${messageId}`);

    return { messageId };
  }
}

function maskPhone(phoneE164: string): string {
  const visiblePrefixLength = Math.max(1, phoneE164.length - 8);
  return `${phoneE164.slice(0, visiblePrefixLength)}****${phoneE164.slice(-4)}`;
}
