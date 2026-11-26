import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { asCsv, dateInChina, formatChinaDate, period, startDate } from '../src/format';

test('business date filters use China midnight and an exclusive end, including leap days', () => {
  assert.deepEqual(period('2024-02-29', '2024-02-29'), {
    startAt: '2024-02-28T16:00:00.000Z',
    endAt: '2024-02-29T16:00:00.000Z',
  });
  assert.equal(startDate('2026-02-29'), undefined);
  assert.equal(startDate('2026-11-31'), undefined);
  assert.equal(period('2026-11-25', '2026-11-24'), undefined);
  assert.ok(period('2024-01-01', '2024-12-31', 366));
  assert.equal(period('2024-01-01', '2025-01-01', 366), undefined);
  const midnight = Date.parse('2026-11-25T16:00:00.000Z');
  assert.equal(dateInChina(-6, midnight), '2026-11-20');
  assert.equal(dateInChina(0, midnight), '2026-11-26');
  assert.equal(formatChinaDate('2026-11-25T16:00:00.000Z'), '2026-11-26');
  assert.equal(formatChinaDate('2026-11-25T15:59:59.999Z'), '2026-11-25');
  assert.equal(formatChinaDate(null), '');
});

test('CSV exports preserve quotes and newlines while neutralizing text formulas', () => {
  assert.equal(asCsv([['库存统计', 'a"b', '第一行\n第二行'], [' =1+1', -3, null]]),
    '\uFEFF"库存统计","a""b","第一行\n第二行"\r\n"\' =1+1","-3",""');
});
