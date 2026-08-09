import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { UserApiGuard } from '../../common/auth/user-api.guard';
import { AddressesController } from './addresses.controller';
import { CreateAddressDto } from './dto/create-address.dto';

test('address DTO validates required fields, lengths, and Chinese mobile numbers', async () => {
  const invalid = plainToInstance(CreateAddressDto, {
    recipientName: '', phoneNumber: '123', provinceName: '', cityName: '', countyName: '',
    streetName: '', detailInfo: '', postalCode: '', nationalCode: '',
  });
  const valid = plainToInstance(CreateAddressDto, {
    recipientName: '张三', phoneNumber: '13800000000', provinceName: '北京市', cityName: '北京市', countyName: '西城区',
    streetName: '太平街', detailInfo: '甲6号', postalCode: '100000', nationalCode: '110102',
  });

  assert.ok((await validate(invalid)).length >= 5);
  assert.deepEqual(await validate(valid), []);
});

test('all address routes require access-token and user-api guards', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AddressesController) as unknown[];
  assert.ok(guards.includes(AccessTokenGuard));
  assert.ok(guards.includes(UserApiGuard));
});

test('address routes scope every operation to the authenticated user', async () => {
  const calls: unknown[] = [];
  const service = {
    list: async (...args: unknown[]) => { calls.push(['list', ...args]); return []; },
    create: async (...args: unknown[]) => { calls.push(['create', ...args]); return { id: 'address-1' }; },
    setDefault: async (...args: unknown[]) => { calls.push(['default', ...args]); return { id: 'address-1' }; },
    remove: async (...args: unknown[]) => { calls.push(['remove', ...args]); },
  };
  const controller = new AddressesController(service as never);
  const user = { userId: 'user-1' } as never;
  const input = plainToInstance(CreateAddressDto, {
    recipientName: '张三', phoneNumber: '13800000000', provinceName: '北京市', cityName: '北京市', countyName: '西城区',
    streetName: '太平街', detailInfo: '甲6号', postalCode: '', nationalCode: '',
  });

  await controller.list(user);
  await controller.create(user, input);
  await controller.setDefault(user, 'address-1');
  await controller.remove(user, 'address-1');

  assert.deepEqual(calls, [
    ['list', 'user-1'],
    ['create', 'user-1', input],
    ['default', 'user-1', 'address-1'],
    ['remove', 'user-1', 'address-1'],
  ]);
});
