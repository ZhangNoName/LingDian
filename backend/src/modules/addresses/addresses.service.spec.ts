import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { CreateUserAddressRequest } from '@lingdian/contracts';
import { AddressesService } from './addresses.service';

const addressInput: CreateUserAddressRequest = {
  recipientName: ' 张三 ',
  phoneNumber: '13800000000',
  provinceName: '北京市',
  cityName: '北京市',
  countyName: '西城区',
  streetName: '太平街',
  detailInfo: ' 甲6号 ',
  postalCode: '100000',
  nationalCode: '110102',
};

type AddressRecord = Omit<CreateUserAddressRequest, never> & {
  id: string;
  userId: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

class AddressPersistence {
  readonly rows: AddressRecord[] = [];
  private nextId = 1;

  readonly userAddress = {} as any;

  constructor() {
    this.userAddress.findMany = async ({ where }: any) => this.rows
      .filter((row) => row.userId === where.userId)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.getTime() - a.updatedAt.getTime());
    this.userAddress.findFirst = async ({ where }: any) => this.find(where);
    this.userAddress.count = async ({ where }: any) => this.rows.filter((row) => this.matches(row, where)).length;
    this.userAddress.create = async ({ data }: any) => {
      const now = new Date(Date.now() + this.nextId);
      const row = { id: `address-${this.nextId++}`, createdAt: now, updatedAt: now, ...data } as AddressRecord;
      this.rows.push(row);
      return row;
    };
    this.userAddress.updateMany = async ({ where, data }: any) => {
      const matched = this.rows.filter((row) => this.matches(row, where));
      matched.forEach((row) => Object.assign(row, data, { updatedAt: new Date() }));
      return { count: matched.length };
    };
    this.userAddress.update = async ({ where, data }: any) => {
      const row = this.rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error('missing row');
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    };
    this.userAddress.delete = async ({ where }: any) => {
      const index = this.rows.findIndex((candidate) => candidate.id === where.id);
      if (index < 0) throw new Error('missing row');
      return this.rows.splice(index, 1)[0];
    };
  }

  async $transaction<T>(callback: (tx: AddressPersistence) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private find(where: any): AddressRecord | null {
    const rows = this.rows.filter((row) => this.matches(row, where));
    return rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
  }

  private matches(row: AddressRecord, where: any): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'id' || key === 'userId' || key === 'isDefault') return row[key] === value;
      if (key === 'NOT') return row.id !== (value as any).id;
      return (row as any)[key] === value;
    });
  }
}

test('first address becomes default and an exact duplicate reuses it', async () => {
  const persistence = new AddressPersistence();
  const service = new AddressesService(persistence as never);

  const created = await service.create('user-1', addressInput);
  const duplicate = await service.create('user-1', addressInput);

  assert.equal(created.id, duplicate.id);
  assert.equal(created.isDefault, true);
  assert.equal(created.recipientName, '张三');
  assert.equal(created.detailInfo, '甲6号');
  assert.equal(persistence.rows.length, 1);
});

test('a user cannot save more than twenty addresses', async () => {
  const persistence = new AddressPersistence();
  const service = new AddressesService(persistence as never);
  for (let index = 0; index < 20; index += 1) {
    await service.create('user-1', { ...addressInput, detailInfo: `甲${index}号` });
  }

  await assert.rejects(
    () => service.create('user-1', { ...addressInput, detailInfo: '第21个地址' }),
    /20 addresses/i,
  );
  assert.equal(persistence.rows.length, 20);
});

test('setting a default address clears the previous default only for that user', async () => {
  const persistence = new AddressPersistence();
  const service = new AddressesService(persistence as never);
  const first = await service.create('user-1', addressInput);
  const second = await service.create('user-1', { ...addressInput, detailInfo: '乙8号' });
  const other = await service.create('user-2', addressInput);

  await service.setDefault('user-1', second.id);

  assert.equal(persistence.rows.find((row) => row.id === first.id)?.isDefault, false);
  assert.equal(persistence.rows.find((row) => row.id === second.id)?.isDefault, true);
  assert.equal(persistence.rows.find((row) => row.id === other.id)?.isDefault, true);
});

test('deleting the default address promotes the most recently updated remaining address', async () => {
  const persistence = new AddressPersistence();
  const service = new AddressesService(persistence as never);
  const first = await service.create('user-1', addressInput);
  const second = await service.create('user-1', { ...addressInput, detailInfo: '乙8号' });

  await service.remove('user-1', first.id);

  assert.equal(persistence.rows.find((row) => row.id === second.id)?.isDefault, true);
});

test('address ownership is enforced for lookup, defaulting, and deletion', async () => {
  const persistence = new AddressPersistence();
  const service = new AddressesService(persistence as never);
  const address = await service.create('user-1', addressInput);

  await assert.rejects(() => service.findOwnedAddress('user-2', address.id), /not found/i);
  await assert.rejects(() => service.setDefault('user-2', address.id), /not found/i);
  await assert.rejects(() => service.remove('user-2', address.id), /not found/i);
  assert.equal(persistence.rows.length, 1);
});
