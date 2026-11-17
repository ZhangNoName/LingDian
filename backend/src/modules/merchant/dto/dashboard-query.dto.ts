import { BadRequestException } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';
export class DashboardQueryDto {
  @IsISO8601({ strict: true, strictSeparator: true }) @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startAt!: string;
  @IsISO8601({ strict: true, strictSeparator: true }) @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endAt!: string;
}
export function dashboardPeriod(query: DashboardQueryDto) {
  const start = new Date(query.startAt), end = new Date(query.endAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end.getTime() - start.getTime() > 366 * 86400000) throw new BadRequestException('dashboard.invalidPeriod');
  return { start, end };
}
