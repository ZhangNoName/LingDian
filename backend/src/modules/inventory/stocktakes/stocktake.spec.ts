import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateStocktakeDto, SaveStocktakeDto } from './stocktake.dto';
import { StocktakeService } from './stocktake.service';
test('stocktake DTOs distinguish blank counts from zero and bound item selection, precision and versions', () => {
  const input = { requestId: 'count-request', title: 'Daily count', note: 'Closing shift', itemIds: ['a', 'b'] };
  assert.equal(validateSync(plainToInstance(CreateStocktakeDto, input)).length, 0);
  for (const itemIds of [[], ['a', 'a'], Array.from({ length: 51 }, (_, i) => String(i)), ['a'.repeat(192)]])
    assert.ok(validateSync(plainToInstance(CreateStocktakeDto, { ...input, itemIds })).length);
  for (const countedQuantity of [null, 0, 1.125, 999999])
    assert.equal(
      validateSync(plainToInstance(SaveStocktakeDto, { expectedVersion: 0, lines: [{ lineId: 'l', countedQuantity }] }))
        .length,
      0,
    );
  for (const countedQuantity of [undefined, -1, 1.0001, NaN, '1'])
    assert.ok(
      validateSync(plainToInstance(SaveStocktakeDto, { expectedVersion: 0, lines: [{ lineId: 'l', countedQuantity }] }))
        .length,
    );
  assert.ok(validateSync(plainToInstance(SaveStocktakeDto, { lines: [{ lineId: 'l', countedQuantity: 0 }] })).length);
  assert.ok(
    validateSync(plainToInstance(CreateStocktakeDto, { ...input, storeId: 'foreign', status: 'POSTED' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }).length,
  );
});
test('every stocktake operation checks merchant store scope before looking up any business or replay data', async () => {
  const scope = {
      assertIncludes: () => {
        throw Error('scope denied');
      },
    } as never,
    db = new Proxy(
      {},
      {
        get() {
          throw Error('early database access');
        },
      },
    ) as never,
    service = new StocktakeService(db, scope),
    user = {} as never;
  for (const run of [
    () => service.list(user, 'foreign', {} as never),
    () => service.detail(user, 'foreign', 'c'),
    () => service.create(user, 'foreign', {} as never),
    () => service.save(user, 'foreign', 'c', {} as never),
    () => service.refresh(user, 'foreign', 'c', {} as never),
    () => service.post(user, 'foreign', 'c', {} as never),
    () => service.cancel(user, 'foreign', 'c', {} as never),
  ])
    await assert.rejects(run, /scope denied/);
});
