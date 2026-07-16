import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { SystemLogCategory, SystemLogLevel, SystemLogPage, SystemLogSource } from '@lingdian/contracts';
import { PrismaService } from '../../prisma/prisma.service';

const SECRET_KEY = /authorization|cookie|password|secret|token|credential/i;
const MAX_VALUE_LENGTH = 1024;
const MAX_DETAILS_LENGTH = 4096;
const RETENTION_DAYS = 30;
const RETENTION_INTERVAL_MS = 60 * 60 * 1000;
const CLIENT_EVENT_LIMIT = 20;
const CLIENT_EVENT_WINDOW_MS = 60 * 1000;

export type SystemLogInput = {
  source: SystemLogSource;
  level: SystemLogLevel;
  category?: SystemLogCategory;
  event: string;
  message: string;
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  ip?: string;
  details?: Record<string, unknown>;
};

export type SystemLogQuery = {
  source?: SystemLogSource;
  level?: SystemLogLevel;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
};

@Injectable()
export class SystemLogService implements OnModuleInit, OnModuleDestroy {
  private lastRetentionAt = 0;
  private readonly clientWindows = new Map<string, { count: number; expiresAt: number }>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  private now(): Date {
    return new Date();
  }

  onModuleInit(): void {
    void this.cleanupExpiredLogs(this.now()).catch(() => undefined);
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredLogs(this.now()).catch(() => undefined);
    }, RETENTION_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async record(input: SystemLogInput): Promise<void> {
    const now = this.now();
    await this.prisma.systemLog.create({
      data: {
        source: input.source,
        level: input.level,
        category: input.category ?? 'HTTP',
        event: truncate(input.event, 64),
        message: sanitizeLogMessage(input.message),
        ...(input.requestId ? { requestId: truncate(input.requestId, 64) } : {}),
        ...(input.userId ? { userId: truncate(input.userId, 191) } : {}),
        ...(input.method ? { method: truncate(input.method, 16).toUpperCase() } : {}),
        ...(input.path ? { path: sanitizePath(input.path) } : {}),
        ...(Number.isInteger(input.statusCode) ? { statusCode: input.statusCode } : {}),
        ...(input.ip ? { ip: maskIp(input.ip) } : {}),
        ...(input.details ? { details: sanitizeLogDetails(input.details) as Prisma.InputJsonValue } : {}),
      },
    });

    if (now.getTime() - this.lastRetentionAt < RETENTION_INTERVAL_MS) return;
    this.lastRetentionAt = now.getTime();
    await this.cleanupExpiredLogs(now);
  }

  async recordClientEvent(input: SystemLogInput): Promise<void> {
    if (input.source === 'SERVER') {
      throw new Error('Client logs must identify a frontend source.');
    }
    if (input.level !== 'WARN' && input.level !== 'ERROR') {
      throw new Error('Client logs must use WARN or ERROR level.');
    }
    if (!this.acceptClientEvent(input.source, input.ip)) return;

    await this.record({ ...input, category: 'CLIENT', requestId: undefined });
  }

  async query(query: SystemLogQuery): Promise<SystemLogPage> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const records = await this.prisma.systemLog.findMany({
      where: {
        ...(query.source ? { source: query.source } : {}),
        ...(query.level ? { level: query.level } : {}),
        ...((query.from || query.to) ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    const items = records.slice(0, limit).map((record) => ({
      ...record,
      source: record.source as SystemLogSource,
      level: record.level as SystemLogLevel,
      category: record.category as SystemLogCategory,
      details: record.details ? sanitizeLogDetails(record.details) : null,
      createdAt: record.createdAt.toISOString(),
    }));

    return { items, nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null };
  }

  private acceptClientEvent(source: SystemLogSource, ip?: string): boolean {
    const now = this.now().getTime();
    for (const [key, window] of this.clientWindows) {
      if (window.expiresAt <= now) this.clientWindows.delete(key);
    }
    const key = `${source}:${maskIp(ip ?? 'unknown')}`;
    const window = this.clientWindows.get(key);
    if (!window || window.expiresAt <= now) {
      this.clientWindows.set(key, { count: 1, expiresAt: now + CLIENT_EVENT_WINDOW_MS });
      return true;
    }
    if (window.count >= CLIENT_EVENT_LIMIT) return false;
    window.count += 1;
    return true;
  }

  private async cleanupExpiredLogs(now: Date): Promise<void> {
    await this.prisma.systemLog.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    });
  }
}

export function sanitizeLogDetails(value: unknown): Record<string, unknown> {
  const details = sanitize(value, 0);
  const serialized = JSON.stringify(details);

  if (serialized.length <= MAX_DETAILS_LENGTH) return details as Record<string, unknown>;

  return { truncated: true };
}

export function sanitizeLogMessage(value: string): string {
  return truncate(
    value
      .replace(/(bearer\s+)[^\s?&]+/gi, '$1[REDACTED]')
      .replace(/([?&](?:access_)?token=)[^&\s]+/gi, '$1[REDACTED]'),
    512,
  );
}

function sanitize(value: unknown, depth: number): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (typeof value === 'string') return value.slice(0, MAX_VALUE_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (typeof value !== 'object') return String(value).slice(0, MAX_VALUE_LENGTH);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).slice(0, 30).map(([key, nestedValue]) => [
      key,
      SECRET_KEY.test(key) ? '[REDACTED]' : sanitize(nestedValue, depth + 1),
    ]),
  );
}

function truncate(value: string, limit: number): string {
  return value.trim().slice(0, limit);
}

function maskIp(ip: string): string {
  const normalized = ip.trim();
  if (normalized.includes('.')) return normalized.replace(/\.\d+$/, '.***');
  return normalized.length <= 8 ? '***' : `${normalized.slice(0, 6)}***`;
}

function sanitizePath(value: string): string {
  try {
    return truncate(new URL(value, 'http://log.local').pathname, 256);
  } catch {
    return truncate(value.split('?', 1)[0], 256);
  }
}
