import { Logger, Module } from '@nestjs/common';
import { ConsoleSmsProvider } from './console-sms.provider';
import { SMS_LOGGER, SMS_PROVIDER } from './sms-provider';
import { WebhookSmsProvider } from './webhook-sms.provider';

@Module({
  providers: [
    ConsoleSmsProvider,
    WebhookSmsProvider,
    {
      provide: SMS_LOGGER,
      useFactory: () => new Logger(ConsoleSmsProvider.name),
    },
    {
      provide: SMS_PROVIDER,
      inject: [ConsoleSmsProvider, WebhookSmsProvider],
      useFactory: (consoleProvider: ConsoleSmsProvider, webhookProvider: WebhookSmsProvider) => {
        const selected = process.env.SMS_PROVIDER ?? 'console';
        if (selected === 'console' && process.env.NODE_ENV !== 'production') return consoleProvider;
        if (selected === 'webhook') return webhookProvider;
        throw new Error(`SMS_PROVIDER=${selected} is not a registered production SMS provider. Register a real SmsProvider adapter before startup.`);
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsProviderModule {}
