import { Logger, Module } from '@nestjs/common';
import { ConsoleSmsProvider } from './console-sms.provider';
import { SMS_LOGGER, SMS_PROVIDER } from './sms-provider';

@Module({
  providers: [
    ConsoleSmsProvider,
    {
      provide: SMS_LOGGER,
      useFactory: () => new Logger(ConsoleSmsProvider.name),
    },
    {
      provide: SMS_PROVIDER,
      inject: [ConsoleSmsProvider],
      useFactory: (consoleProvider: ConsoleSmsProvider) => {
        const selected = process.env.SMS_PROVIDER ?? 'console';
        if (selected === 'console' && process.env.NODE_ENV !== 'production') return consoleProvider;
        throw new Error(`SMS_PROVIDER=${selected} is not a registered production SMS provider. Register a real SmsProvider adapter before startup.`);
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsProviderModule {}
