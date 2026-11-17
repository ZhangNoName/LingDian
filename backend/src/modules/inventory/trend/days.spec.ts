import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { trendDays, trendPeriod } from './days';
import { InventoryTrendDto } from './inventory-trend.dto';
import { InventoryTrendService } from './inventory-trend.service';
test('trend days follow DST calendar boundaries and preserve exact partial instants', () => {
  const period = trendPeriod({ fromDate: '2026-03-07', toDate: '2026-03-09', timeZone: 'America/New_York' });
  const days = trendDays(period.start, period.end, period.timeZone);
  assert.equal(period.start.toISOString(), '2026-03-07T05:00:00.000Z');
  assert.equal(period.end.toISOString(), '2026-03-10T04:00:00.000Z');
  assert.deepEqual(
    days.map((day) => (day.end.getTime() - day.start.getTime()) / 3600000),
    [24, 23, 24],
  );
  const fall = trendPeriod({ fromDate: '2026-11-01', toDate: '2026-11-01', timeZone: 'America/New_York' });
  assert.equal(fall.end.getTime() - fall.start.getTime(), 25 * 3600000);
  const exact = trendPeriod({
    startAt: '2026-03-07T10:12:13.456Z',
    endAt: '2026-03-09T12:34:56.789Z',
    timeZone: 'America/New_York',
  });
  const partial = trendDays(exact.start, exact.end, exact.timeZone);
  assert.equal(partial[0].start.toISOString(), '2026-03-07T10:12:13.456Z');
  assert.equal(partial[partial.length - 1].end.toISOString(), '2026-03-09T12:34:56.789Z');
  assert.deepEqual(
    partial.map((day) => day.partial),
    [true, false, true],
  );
});
test('missing midnight and skipped whole dates never fabricate a zero-width day', () => {
  const brazil = trendPeriod({ fromDate: '2018-11-04', toDate: '2018-11-04', timeZone: 'America/Sao_Paulo' });
  const days = trendDays(brazil.start, brazil.end, brazil.timeZone);
  assert.equal(days.length, 1);
  assert.equal(days[0].partial, false);
  assert.equal(days[0].end.getTime() - days[0].start.getTime(), 23 * 3600000);
  const samoa = trendPeriod({ fromDate: '2011-12-29', toDate: '2011-12-31', timeZone: 'Pacific/Apia' });
  assert.deepEqual(
    trendDays(samoa.start, samoa.end, samoa.timeZone).map((day) => day.date),
    ['2011-12-29', '2011-12-31'],
  );
  assert.throws(
    () => trendPeriod({ fromDate: '2011-12-30', toDate: '2011-12-30', timeZone: 'Pacific/Apia' }),
    /inventory.invalidPeriod/,
  );
});
test('trend inputs require one complete period, explicit zones and bounded valid dates', () => {
  for (const query of [
    { startAt: '2026-01-01T00:00:00Z' },
    { fromDate: '2026-02-30', toDate: '2026-03-01' },
    { fromDate: '2026-03-02', toDate: '2026-03-01' },
    {
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-01-02T00:00:00Z',
      fromDate: '2026-01-01',
      toDate: '2026-01-02',
    },
    { startAt: '2024-01-01T00:00:00Z', endAt: '2026-01-01T00:00:00Z' },
  ])
    assert.throws(() => trendPeriod({ ...query, timeZone: 'UTC' }), /inventory.invalidPeriod/);
  assert.throws(
    () => trendPeriod({ fromDate: '2026-01-01', toDate: '2026-01-02', timeZone: 'secret/invalid' }),
    /inventory.invalidTimeZone/,
  );
  for (const query of [
    { timeZone: ['UTC'] },
    { fromDate: ['2026-01-01'], timeZone: 'UTC' },
    { startAt: '2026-01-01T00:00:00', timeZone: 'UTC' },
  ])
    assert.ok(validateSync(plainToInstance(InventoryTrendDto, query)).length);
  const full = trendPeriod({
    startAt: '2026-01-01T12:00:00Z',
    endAt: '2027-01-02T12:00:00Z',
    timeZone: 'UTC',
  });
  assert.equal(trendDays(full.start, full.end, full.timeZone).length, 367);
});
test('daily trend scope is checked before database access and unsafe quantities fail closed', async () => {
  const db = new Proxy(
    {},
    {
      get() {
        throw Error('database accessed');
      },
    },
  ) as never;
  await assert.rejects(
    new InventoryTrendService(db, {
      assertIncludes() {
        throw Error('scope first');
      },
    } as never).report({} as never, 'foreign', 'id', {} as never),
    /scope first/,
  );
  const tx = {
    inventoryItem: { findUnique: async () => ({ createdAt: new Date('2025-01-01') }) },
    $queryRaw: async () => [{ quantityDelta: 9007199254740992n, reservedDelta: 0 }],
  };
  const service = new InventoryTrendService(
    { $transaction: (run: (db: unknown) => unknown) => run(tx) } as never,
    { assertIncludes() {} } as never,
  );
  await assert.rejects(
    service.report({} as never, 'a', 'id', { fromDate: '2026-01-01', toDate: '2026-01-02', timeZone: 'UTC' }),
    /inventory.trendOverflow/,
  );
});
