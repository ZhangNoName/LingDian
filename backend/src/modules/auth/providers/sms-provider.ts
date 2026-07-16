export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
export const SMS_LOGGER = Symbol('SMS_LOGGER');

export interface SmsProvider {
  send(input: { phoneE164: string; code: string }): Promise<{ messageId: string }>;
}

export interface SmsLogger {
  log(message: string): void;
}
