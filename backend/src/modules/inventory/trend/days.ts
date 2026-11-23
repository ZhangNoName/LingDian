import { BadRequestException } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import type { InventoryTrendDto } from './inventory-trend.dto';
export const MAX_TREND_DAYS = 368;
export interface TrendDayBoundary {
  date: string;
  start: Date;
  end: Date;
  partial: boolean;
}
export function trendPeriod(query: InventoryTrendDto) {
  let zone: string;
  try {
    zone = Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(query.timeZone).timeZoneId;
  } catch {
    throw new BadRequestException('inventory.invalidTimeZone');
  }
  try {
    let start: Date, end: Date;
    if (query.startAt && query.endAt && !query.fromDate && !query.toDate) {
      start = new Date(query.startAt);
      end = new Date(query.endAt);
    } else if (query.fromDate && query.toDate && !query.startAt && !query.endAt) {
      const from = Temporal.PlainDate.from(query.fromDate),
        to = Temporal.PlainDate.from(query.toDate);
      const first = from.toZonedDateTime(zone),
        last = to.toZonedDateTime(zone);
      if (!first.toPlainDate().equals(from) || !last.toPlainDate().equals(to))
        throw Error('nonexistent calendar date');
      start = new Date(first.epochMilliseconds);
      end = new Date(to.add({ days: 1 }).toZonedDateTime(zone).epochMilliseconds);
    } else throw Error('use exactly one complete range');
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start >= end ||
      end.getTime() - start.getTime() > 366 * 86400000
    )
      throw Error('invalid range');
    return { start, end, timeZone: zone };
  } catch {
    throw new BadRequestException('inventory.invalidPeriod');
  }
}
/** Calendar-day boundaries, not fixed 24-hour offsets. Includes clipped first and last days. */
export function trendDays(start: Date, end: Date, timeZone: string): TrendDayBoundary[] {
  const days: TrendDayBoundary[] = [];
  let cursor = start.getTime();
  while (cursor < end.getTime()) {
    if (days.length >= MAX_TREND_DAYS) throw new BadRequestException('inventory.invalidPeriod');
    const local = Temporal.Instant.fromEpochMilliseconds(cursor).toZonedDateTimeISO(timeZone);
    let date = local.toPlainDate().add({ days: 1 });
    let next = date.toZonedDateTime(timeZone).epochMilliseconds;
    // Whole skipped dates must not create a zero-width or fabricated day.
    while (next <= cursor) {
      date = date.add({ days: 1 });
      next = date.toZonedDateTime(timeZone).epochMilliseconds;
    }
    const until = Math.min(next, end.getTime());
    days.push({
      date: local.toPlainDate().toString(),
      start: new Date(cursor),
      end: new Date(until),
      partial: cursor !== local.startOfDay().epochMilliseconds || until !== next,
    });
    cursor = until;
  }
  return days;
}
