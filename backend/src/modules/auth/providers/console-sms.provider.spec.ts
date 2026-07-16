import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { ConsoleSmsProvider } from './console-sms.provider';
import { SmsProviderModule } from './sms-provider.module';
import { SMS_LOGGER, SMS_PROVIDER, SmsProvider } from './sms-provider';

test('console SMS provider returns a provider message id without exposing the code', async () => {
  const logEntries: string[] = [];
  const moduleRef = await Test.createTestingModule({ imports: [SmsProviderModule] })
    .overrideProvider(SMS_LOGGER)
    .useValue({ log: (entry: string) => logEntries.push(entry) })
    .compile();
  const provider = moduleRef.get<SmsProvider>(SMS_PROVIDER);

  const result = await provider.send({ phoneE164: '+8613800000000', code: '123456' });

  assert.match(result.messageId, /^console_/);
  assert.equal('code' in result, false);
  assert.deepEqual(logEntries, [
    `Sent SMS to +86138****0000 with message id ${result.messageId}`,
  ]);
  assert.doesNotMatch(String(logEntries[0]), /123456/);

  await moduleRef.close();
});

test('SMS provider token resolves the console adapter and can be replaced with a fake', async () => {
  const defaultModule = await Test.createTestingModule({ imports: [SmsProviderModule] }).compile();
  assert.ok(defaultModule.get<SmsProvider>(SMS_PROVIDER) instanceof ConsoleSmsProvider);
  await defaultModule.close();

  const fakeProvider: SmsProvider = {
    send: async () => ({ messageId: 'fake_message' }),
  };
  const testModule = await Test.createTestingModule({ imports: [SmsProviderModule] })
    .overrideProvider(SMS_PROVIDER)
    .useValue(fakeProvider)
    .compile();

  assert.equal(testModule.get<SmsProvider>(SMS_PROVIDER), fakeProvider);
  await testModule.close();
});
