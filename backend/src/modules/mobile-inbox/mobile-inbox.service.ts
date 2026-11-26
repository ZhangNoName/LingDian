import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser, InboxAnchor, InboxMessage, InboxPage, InboxUnreadStatus } from '@lingdian/contracts';
import { Prisma } from '@lingdian/db';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { StoreContextResolver } from '../stores/store-context.resolver';

const PAGE_SIZE = 25;
const HISTORY_DAYS = 30;
const EVENT_ID = /^(?:order-status|order|inventory|inventory-escalated|system):[a-zA-Z0-9_-]{1,40}$/;

type InboxRow = Omit<InboxMessage, 'createdAt' | 'read'> & { createdAt: Date; readAt: Date | null };
type InboxScope = { key: string; sources: Prisma.Sql[] };

@Injectable()
export class MobileInboxService {
  constructor(
    private readonly db: PrismaService,
    private readonly merchants: MerchantStoreScope,
    private readonly stores: StoreContextResolver,
  ) {}

  async page(user: AuthenticatedUser, storeId?: string, rawCursor?: string): Promise<InboxPage> {
    const scope = this.scope(user, storeId);
    const cursor = rawCursor === undefined ? undefined : decodeCursor(rawCursor);
    const seek = cursor
      ? Prisma.sql`WHERE (m.createdAt < ${cursor.time} OR (m.createdAt = ${cursor.time} AND m.id < ${cursor.id}))`
      : Prisma.empty;
    // Each source can contribute at most one page to the merged result.
    const candidates = scope.sources.map((source) => Prisma.sql`(
      SELECT m.* FROM (${source}) m ${seek}
      ORDER BY m.createdAt DESC, m.id DESC LIMIT ${PAGE_SIZE + 1}
    )`);
    const rows = await this.db.$queryRaw<InboxRow[]>`
      SELECT m.*, r.readAt FROM (${Prisma.join(candidates, ' UNION ALL ')}) m
      LEFT JOIN mobile_inbox_reads r ON ${receiptJoin(user.userId, scope.key)}
      ORDER BY m.createdAt DESC, m.id DESC
      LIMIT ${PAGE_SIZE + 1}
    `;
    const items = rows.slice(0, PAGE_SIZE).map(({ createdAt, readAt, ...row }) => ({
      ...row, createdAt: createdAt.toISOString(), read: readAt !== null,
    }));
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: rows.length > PAGE_SIZE && last
        ? Buffer.from(`${last.createdAt}|${last.id}`).toString('base64url')
        : null,
    };
  }

  async unread(user: AuthenticatedUser, storeId?: string): Promise<InboxUnreadStatus> {
    const { key, sources } = this.scope(user, storeId);
    const anchor = Prisma.sql`CONCAT(LEFT(DATE_FORMAT(m.createdAt, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z|', m.id)`;
    const summaries = sources.map((source) => Prisma.sql`
      SELECT COUNT(CASE WHEN r.eventId IS NULL THEN 1 END) AS count, COUNT(*) AS totalEvents,
        MAX(CASE WHEN r.eventId IS NULL THEN ${anchor} END) AS newestUnread,
        MAX(${anchor}) AS newestEvent
      FROM (${source}) m
      LEFT JOIN mobile_inbox_reads r ON ${receiptJoin(user.userId, key)}
    `);
    const [result] = await this.db.$queryRaw<Array<{ count: bigint; totalEvents: bigint; newestUnread: string | null; newestEvent: string | null }>>`
      SELECT CAST(SUM(s.count) AS UNSIGNED) AS count, CAST(SUM(s.totalEvents) AS UNSIGNED) AS totalEvents,
        MAX(s.newestUnread) AS newestUnread, MAX(s.newestEvent) AS newestEvent
      FROM (${Prisma.join(summaries, ' UNION ALL ')}) s
    `;
    return {
      count: Number(result.count), newestUnread: decodeSummaryAnchor(result.newestUnread),
      totalEvents: Number(result.totalEvents), newestEvent: decodeSummaryAnchor(result.newestEvent),
    };
  }

  async markRead(user: AuthenticatedUser, storeId?: string, eventId?: string, through?: InboxAnchor): Promise<void> {
    if (eventId !== undefined && !EVENT_ID.test(eventId)) throw new BadRequestException('Invalid inbox event id.');
    const boundary = through ? parseAnchor(through.createdAt, through.id) : undefined;
    const { key, sources } = this.scope(user, storeId);
    const where = eventId !== undefined ? Prisma.sql`WHERE m.id = ${eventId}` : boundary
      ? Prisma.sql`WHERE (m.createdAt < ${boundary.time} OR (m.createdAt = ${boundary.time} AND m.id <= ${boundary.id}))`
      : Prisma.empty;
    await this.db.$executeRaw`
      INSERT INTO mobile_inbox_reads (userId, scope, eventId)
      SELECT ${user.userId}, ${key}, m.id FROM (${Prisma.join(sources, ' UNION ALL ')}) m
      ${where}
      ORDER BY m.id
      ON DUPLICATE KEY UPDATE readAt = mobile_inbox_reads.readAt
    `;
  }

  private scope(user: AuthenticatedUser, storeId?: string): InboxScope {
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000);
    if (user.audience === 'user-api') {
      const store = this.stores.mode === 'single' ? Prisma.sql`AND o.storeId = ${this.stores.primaryStoreId()}` : Prisma.empty;
      return { key: 'customer', sources: [Prisma.sql`
        SELECT CONCAT('order-status:', l.id) AS id, 'ORDER_UPDATE' AS kind, o.id AS targetId,
          o.orderNo AS subject, l.toStatus AS state, l.createdAt
        FROM orders o INNER JOIN order_status_logs l ON l.orderId = o.id
        WHERE o.customerUserId = ${user.userId} AND o.isDeleted = FALSE ${store}
          AND l.createdAt >= ${since}
          AND l.toStatus IN ('PENDING_PAYMENT','PAID','PREPARING','READY','COMPLETED','TIMED_OUT','REFUNDING','REFUNDED','CANCELLED','FAILED')
      `] };
    }
    if (user.audience === 'merchant-api') {
      const [activeStore] = this.merchants.forRequest(user, storeId);
      const storeKey = createHash('sha256').update(activeStore).digest('base64url');
      return { key: `merchant:${storeKey}`, sources: [
        Prisma.sql`
          SELECT CONCAT('order:', o.id) AS id, 'NEW_ORDER' AS kind, o.id AS targetId,
            o.orderNo AS subject, '' AS state, o.createdAt
          FROM orders o WHERE o.storeId = ${activeStore} AND o.isDeleted = FALSE AND o.createdAt >= ${since}
        `,
        Prisma.sql`
          SELECT CONCAT('inventory:', a.id) AS id, 'INVENTORY_ALERT' AS kind, a.id AS targetId,
            i.name AS subject, IF(a.availableAtTrigger = 0, 'OUT', 'LOW') AS state, a.detectedAt AS createdAt
          FROM inventory_alerts a INNER JOIN inventory_items i ON i.id = a.itemId AND i.storeId = a.storeId
          WHERE a.storeId = ${activeStore} AND a.detectedAt >= ${since}
        `,
        Prisma.sql`
          SELECT CONCAT('inventory-escalated:', e.id) AS id, 'INVENTORY_ALERT' AS kind, a.id AS targetId,
            i.name AS subject, 'OUT' AS state, e.createdAt
          FROM auth_audit_logs e INNER JOIN inventory_alerts a ON
            a.id = JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.alertId')) AND a.storeId = ${activeStore}
          INNER JOIN inventory_items i ON i.id = a.itemId AND i.storeId = a.storeId
          WHERE e.event = 'INVENTORY_ALERT_ESCALATED' AND e.createdAt >= ${since}
            AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.storeId')) = ${activeStore}
        `,
      ] };
    }
    if (!user.roles.includes('ADMIN') && !user.roles.includes('SUPER_ADMIN')) throw new ForbiddenException();
    const store = this.stores.mode === 'single' ? Prisma.sql`AND o.storeId = ${this.stores.primaryStoreId()}` : Prisma.empty;
    const sources = [Prisma.sql`
      SELECT CONCAT('order:', o.id) AS id, 'NEW_ORDER' AS kind, o.id AS targetId,
        o.orderNo AS subject, '' AS state, o.createdAt
      FROM orders o WHERE o.isDeleted = FALSE AND o.createdAt >= ${since} ${store}
    `];
    if (user.roles.includes('SUPER_ADMIN')) sources.push(Prisma.sql`
      SELECT CONCAT('system:', s.id) AS id, 'SYSTEM_ALERT' AS kind, s.id AS targetId,
        s.event AS subject, s.level AS state, s.createdAt
      FROM system_logs s WHERE s.source = 'SERVER' AND s.level = 'FATAL' AND s.createdAt >= ${since}
    `);
    return { key: 'admin', sources };
  }
}

function receiptJoin(userId: string, scope: string) {
  return Prisma.sql`r.userId = ${userId} AND r.scope = ${scope} AND r.eventId = m.id`;
}

function decodeSummaryAnchor(value: string | null): InboxAnchor | null {
  if (!value) return null;
  const [createdAt, id] = value.split('|');
  return { createdAt, id };
}

function decodeCursor(value: string): { time: Date; id: string } {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new BadRequestException('Invalid inbox cursor.');
  const [timestamp, id, extra] = Buffer.from(value, 'base64url').toString().split('|');
  if (extra !== undefined) throw new BadRequestException('Invalid inbox cursor.');
  return parseAnchor(timestamp, id);
}

function parseAnchor(timestamp: string, id: string): { time: Date; id: string } {
  const time = new Date(timestamp);
  if (!Number.isFinite(time.getTime()) || time.toISOString() !== timestamp || !EVENT_ID.test(id)) {
    throw new BadRequestException('Invalid inbox boundary.');
  }
  return { time, id };
}
