import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrderPickupSubscription } from '@lingdian/contracts';
import { Prisma } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import { identitySubject } from '../auth/oauth.service';
import { WechatOAuthProvider } from '../auth/providers/wechat-oauth.provider';
import { StoreContextResolver } from '../stores/store-context.resolver';
import { readPickupTemplate, sendWechatPickup, type PickupSendOutcome } from './pickup-notification-wechat';

const MAX_ATTEMPTS = 4;
const POLL_INTERVAL_MS = 5_000;
const eligibleStatuses = ['PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY'] as const;
const orderSelect = {
  id: true, status: true, orderSource: true, orderType: true, pickupCode: true, updatedAt: true,
  pickupNotification: { select: { orderId: true } },
} satisfies Prisma.OrderSelect;
const clock = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Shanghai' });

@Injectable()
export class OrderPickupNotificationService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OrderPickupNotificationService.name);
  private readonly template;
  private timer?: ReturnType<typeof setInterval>;
  private flushing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechat: WechatOAuthProvider,
    private readonly stores: StoreContextResolver,
    config: ConfigService,
  ) {
    this.template = readPickupTemplate(config);
    if (this.template && !this.wechat.isMiniProgramConfigured()) {
      throw new Error('WeChat pickup notifications require the mini program App ID and secret');
    }
  }

  onApplicationBootstrap(): void {
    if (!this.template) return;
    this.timer = setInterval(() => this.kick(), POLL_INTERVAL_MS);
    this.timer.unref?.();
    this.kick();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async getSubscription(orderId: string, userId: string): Promise<OrderPickupSubscription | null> {
    if (!this.template) return null;
    const order = await this.prisma.order.findFirst({ where: this.customerOrder(orderId, userId), select: orderSelect });
    if (!order) throw new NotFoundException('Order not found');
    if (!this.isEligible(order)) return null;
    return { template_id: this.template.id, subscribed: Boolean(order.pickupNotification) };
  }

  async subscribe(orderId: string, userId: string, templateId: string, loginCode: string): Promise<OrderPickupSubscription> {
    const current = await this.getSubscription(orderId, userId);
    if (!current || current.template_id !== templateId) throw new BadRequestException('当前订单无法订阅取餐提醒');
    if (current.subscribed) return current;

    const profile = await this.wechat.exchangeMiniProgramCode({ code: loginCode }).catch(() => {
      throw new BadRequestException('无法验证微信小程序身份，请重试');
    });
    const appId = this.wechat.miniProgramAppId;
    const subjects = [...new Set([
      identitySubject(this.wechat, profile, appId),
      identitySubject(this.wechat, { openId: profile.openId }, appId),
    ])];
    const identity = await this.prisma.authIdentity.findFirst({
      where: { provider: 'WECHAT', subject: { in: subjects }, userId, verifiedAt: { not: null } },
      select: { id: true },
    });
    if (!identity) throw new ForbiddenException('请使用本订单所绑定的微信账号');

    const queued = await this.prisma.$transaction(async tx => {
      // Serialize registration with the merchant's READY transition.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM orders WHERE id = ${orderId} AND customerUserId = ${userId} FOR UPDATE`);
      const order = await tx.order.findFirst({ where: this.customerOrder(orderId, userId), select: orderSelect });
      if (!order || !this.isEligible(order)) throw new BadRequestException('当前订单无法订阅取餐提醒');
      if (order.pickupNotification) return false;
      const ready = order.status === 'READY';
      await tx.orderPickupNotification.create({
        data: {
          orderId, customerUserId: userId, templateId, recipientOpenId: profile.openId,
          status: ready ? 'PENDING' : 'SUBSCRIBED',
          readyAt: ready ? order.updatedAt : null,
        },
      });
      return ready;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    if (queued) this.kick();
    return { template_id: templateId, subscribed: true };
  }

  async enqueueReady(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
    if (!this.template) return false;
    const result = await tx.orderPickupNotification.updateMany({
      where: { orderId, status: 'SUBSCRIBED', templateId: this.template.id },
      data: { status: 'PENDING', readyAt: new Date(), nextAttemptAt: new Date() },
    });
    return result.count > 0;
  }

  kick(): void {
    void this.flush().catch(() => this.logger.warn('Pickup notification delivery pass failed'));
  }

  async flush(): Promise<void> {
    if (!this.template || this.flushing) return;
    this.flushing = true;
    try {
      const scope = { order: this.storeWhere() };
      await this.prisma.orderPickupNotification.updateMany({
        where: { ...scope, status: 'SENDING', lockedAt: { lt: new Date(Date.now() - 60_000) } },
        data: { status: 'UNKNOWN', lockedAt: null },
      });
      const jobs = await this.prisma.orderPickupNotification.findMany({
        where: { ...scope, status: 'PENDING', nextAttemptAt: { lte: new Date() } },
        orderBy: { nextAttemptAt: 'asc' },
        select: { orderId: true, attempts: true },
        take: 20,
      });
      for (const job of jobs) await this.deliver(job.orderId, job.attempts);
    } finally {
      this.flushing = false;
    }
  }

  private async deliver(orderId: string, attempts: number): Promise<void> {
    const template = this.template;
    if (!template) return;
    const lockedAt = new Date();
    const claimed = await this.prisma.orderPickupNotification.updateMany({
      where: { orderId, status: 'PENDING', attempts },
      data: { status: 'SENDING', lockedAt, attempts: { increment: 1 } },
    });
    if (!claimed.count) return;
    const job = await this.prisma.orderPickupNotification.findUnique({
      where: { orderId, status: 'SENDING', lockedAt },
      include: {
        order: {
          select: {
            status: true, orderSource: true, orderType: true, pickupCode: true, updatedAt: true,
            orderNo: true, isDeleted: true, customerUserId: true,
            store: { select: { name: true } }, customerUser: { select: { status: true } },
          },
        },
      },
    });
    if (!job) return;
    const { order } = job;
    let outcome: PickupSendOutcome = { status: 'SKIPPED' };
    if (job.templateId === template.id && order.status === 'READY' && !order.isDeleted &&
        order.customerUserId === job.customerUserId && order.customerUser?.status === 'ACTIVE' &&
        order.pickupCode && this.isEligible(order)) {
      outcome = await sendWechatPickup(this.wechat, template, job.recipientOpenId, orderId, {
        pickupCode: order.pickupCode,
        orderNo: order.orderNo,
        storeName: order.store.name,
        readyAt: clock.format(job.readyAt ?? order.updatedAt),
      });
    }
    const status = outcome.status === 'PENDING' && job.attempts >= MAX_ATTEMPTS ? 'FAILED' : outcome.status;
    await this.prisma.orderPickupNotification.updateMany({
      where: { orderId, status: 'SENDING', lockedAt },
      data: {
        status,
        lockedAt: null,
        lastErrorCode: 'code' in outcome ? outcome.code ?? null : null,
        ...(status === 'PENDING' && { nextAttemptAt: new Date(Date.now() + POLL_INTERVAL_MS * 2 ** job.attempts) }),
      },
    });
  }

  private storeWhere(): Prisma.OrderWhereInput {
    return this.stores.mode === 'multi' ? {} : { storeId: this.stores.primaryStoreId() };
  }

  private customerOrder(id: string, customerUserId: string): Prisma.OrderWhereInput {
    return { ...this.storeWhere(), id, customerUserId, isDeleted: false };
  }

  private isEligible(order: Pick<Prisma.OrderGetPayload<{ select: typeof orderSelect }>, 'status' | 'pickupCode' | 'orderType' | 'orderSource'>): boolean {
    return order.orderSource === 'MINIAPP' && order.orderType !== 'TAKEOUT' && Boolean(order.pickupCode) &&
      eligibleStatuses.some(status => status === order.status);
  }
}
