import { ConflictException, Injectable } from '@nestjs/common';
import { PaymentChannel, Prisma } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type GatewayCloseResult,
  PaymentGatewayFactory,
} from './payment.gateway';

type ExpiredIntentCandidate = {
  id: string;
  orderId: string;
  paymentNo: string;
  providerIntentId: string | null;
  channel: PaymentChannel;
  status: string;
  activeOrderKey: string | null;
  expiresAt: Date;
  account: {
    provider: string;
    externalAccountId: string;
    connectorConfigKey: string;
  };
};

const RECOVERABLE_INTENT_STATUSES = ['CREATED', 'PENDING', 'PROCESSING'] as const;

@Injectable()
export class PaymentExpiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateways: PaymentGatewayFactory,
  ) {}

  isExpiredActiveIntent(intent: { status: string; expiresAt: Date }): boolean {
    return RECOVERABLE_INTENT_STATUSES.includes(
      intent.status as typeof RECOVERABLE_INTENT_STATUSES[number],
    ) && intent.expiresAt <= new Date();
  }

  async recoverExpiredAttempt(orderId: string, storeId: string): Promise<void> {
    const candidate = await this.prisma.paymentIntent.findFirst({
      where: {
        orderId,
        activeOrderKey: orderId,
        status: { in: [...RECOVERABLE_INTENT_STATUSES] },
        expiresAt: { lte: new Date() },
      },
      include: { account: true },
      orderBy: { createdAt: 'asc' },
    }) as ExpiredIntentCandidate | null;
    if (!candidate) return;

    let result: GatewayCloseResult;
    try {
      result = await this.gateways.create(candidate.account).closeIntent({
        paymentNo: candidate.paymentNo,
        providerIntentId: candidate.providerIntentId,
        reason: 'EXPIRED',
      });
    } catch {
      await this.markExpiredAttemptForReview(
        candidate,
        'EXPIRED_CLOSE_UNAVAILABLE',
        'The connector did not prove that the expired attempt is closed',
      );
      throw new ConflictException(
        'Expired payment attempt could not be safely closed; manual review is required',
      );
    }

    const responseMismatch =
      result.paymentNo !== candidate.paymentNo ||
      result.accountExternalId !== candidate.account.externalAccountId ||
      (candidate.providerIntentId !== null && result.providerIntentId !== candidate.providerIntentId) ||
      (result.status === 'CLOSED' && !result.closureId);
    if (responseMismatch) {
      await this.markExpiredAttemptForReview(
        candidate,
        'EXPIRED_CLOSE_MISMATCH',
        'The connector close response did not match the reserved payment attempt',
      );
      throw new ConflictException(
        'Expired payment attempt close response did not match; manual review is required',
      );
    }

    if (result.status !== 'CLOSED') {
      await this.markExpiredAttemptForReview(
        candidate,
        `EXPIRED_CLOSE_${result.status}`,
        `The connector reported ${result.status}; the payment attempt remains blocked`,
        result,
      );
      throw new ConflictException(
        'Expired payment attempt is not proven closed; manual review or a verified webhook is required',
      );
    }

    await this.releaseProviderClosedIntent(candidate, storeId, result);
  }

  async releaseProviderClosedIntent(
    candidate: ExpiredIntentCandidate,
    storeId: string,
    result: GatewayCloseResult,
  ): Promise<boolean> {
    const closedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      // A harmless timestamp write obtains the order row lock without changing
      // business state. Success and reservation use this order -> intent order.
      const lockedOrder = await tx.order.updateMany({
        where: { id: candidate.orderId, storeId },
        data: { updatedAt: closedAt },
      });
      if (lockedOrder.count !== 1) return false;

      const current = await tx.paymentIntent.findUnique({
        where: { id: candidate.id },
        select: {
          orderId: true,
          status: true,
          activeOrderKey: true,
          providerIntentId: true,
          expiresAt: true,
        },
      });
      if (
        !current ||
        current.orderId !== candidate.orderId ||
        current.activeOrderKey !== candidate.orderId ||
        !RECOVERABLE_INTENT_STATUSES.includes(
          current.status as typeof RECOVERABLE_INTENT_STATUSES[number],
        ) ||
        current.expiresAt > closedAt
      ) {
        return false;
      }
      if (current.providerIntentId !== null && current.providerIntentId !== result.providerIntentId) {
        await tx.paymentIntent.updateMany({
          where: { id: candidate.id, activeOrderKey: candidate.orderId },
          data: {
            reconciliationStatus: 'MANUAL_REVIEW',
            failureCode: 'EXPIRED_CLOSE_PROVIDER_MISMATCH',
            failureMessage: 'The provider intent changed while applying the close receipt',
          },
        });
        return false;
      }

      const released = await tx.paymentIntent.updateMany({
        where: {
          id: candidate.id,
          activeOrderKey: candidate.orderId,
          status: { in: [...RECOVERABLE_INTENT_STATUSES] },
          expiresAt: { lte: closedAt },
        },
        data: {
          ...(result.providerIntentId ? { providerIntentId: result.providerIntentId } : {}),
          status: 'EXPIRED',
          activeOrderKey: null,
          failureCode: 'PROVIDER_CONFIRMED_CLOSED',
          failureMessage: `Provider close receipt: ${result.closureId}`.slice(0, 255),
        },
      });
      return released.count === 1;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async markExpiredAttemptForReview(
    candidate: ExpiredIntentCandidate,
    failureCode: string,
    failureMessage: string,
    result?: GatewayCloseResult,
  ): Promise<void> {
    const connectorObservedProcessing =
      result?.status === 'PROCESSING' || result?.status === 'SUCCEEDED';
    await this.prisma.paymentIntent.updateMany({
      where: {
        id: candidate.id,
        activeOrderKey: candidate.orderId,
        status: { in: [...RECOVERABLE_INTENT_STATUSES] },
      },
      data: {
        ...(result?.providerIntentId ? { providerIntentId: result.providerIntentId } : {}),
        ...(connectorObservedProcessing ? { status: 'PROCESSING' as const } : {}),
        reconciliationStatus: 'MANUAL_REVIEW',
        failureCode,
        failureMessage,
      },
    });
  }
}
