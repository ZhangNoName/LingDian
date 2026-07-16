import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, VerificationPurpose } from '@lingdian/db';
import { createHmac, randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { normalizeChinesePhone } from './phone';
import { SMS_PROVIDER, SmsProvider } from './providers/sms-provider';

export const AUTH_REFRESH_PEPPER = Symbol('AUTH_REFRESH_PEPPER');

type IssueVerificationCodeInput = {
  purpose: VerificationPurpose;
  phone: string;
  ip: string;
  deviceId: string;
};

type ConsumeVerificationCodeInput = {
  purpose: VerificationPurpose;
  phone: string;
  code: string;
};

type VerificationIssueResult = {
  messageId: string;
  testCode?: string;
};

type RateLimitDimension = 'phone' | 'ip' | 'device';

type CodeReservation = { code: string } | { limitedBy: RateLimitDimension };

const RESERVATION_TRANSACTION_MAX_ATTEMPTS = 3;

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    private readonly audit: AuditService,
    @Inject(AUTH_REFRESH_PEPPER) private readonly refreshPepper: string,
  ) {}

  async issue(input: IssueVerificationCodeInput): Promise<VerificationIssueResult> {
    const phoneE164 = normalizeChinesePhone(input.phone);
    const now = new Date();
    const targetHash = this.hashTarget(phoneE164);

    const reservation = await this.reserveWithRetry({ ...input, phoneE164, targetHash, now });

    if ('limitedBy' in reservation) {
      await this.audit.record({
        event: 'RATE_LIMITED',
        ip: input.ip,
        device: input.deviceId,
        metadata: { phone: maskPhone(phoneE164), limitedBy: reservation.limitedBy },
      });
      throw new HttpException('Too many verification codes requested.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const message = await this.smsProvider.send({ phoneE164, code: reservation.code });

    await this.audit.record({
      event: 'CODE_SENT',
      ip: input.ip,
      device: input.deviceId,
      metadata: { phone: maskPhone(phoneE164), messageId: message.messageId },
    });

    return process.env.NODE_ENV === 'test'
      ? { messageId: message.messageId, testCode: reservation.code }
      : { messageId: message.messageId };
  }

  async consume(input: ConsumeVerificationCodeInput, client?: Prisma.TransactionClient): Promise<void> {
    const phoneE164 = normalizeChinesePhone(input.phone);
    const now = new Date();
    const consumeInTransaction = async (tx: Prisma.TransactionClient) => {
      const code = await tx.verificationCode.findFirst({
        where: {
          purpose: input.purpose,
          targetHash: this.hashTarget(phoneE164),
          codeHash: this.hashCode(input.purpose, phoneE164, input.code),
          consumedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!code) return false;

      const result = await tx.verificationCode.updateMany({
        data: { consumedAt: now },
        where: {
          id: code.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
      });
      return result.count === 1;
    };
    const consumed = client
      ? await consumeInTransaction(client)
      : await this.prisma.$transaction(consumeInTransaction);

    if (!consumed) {
      await this.audit.record({
        event: 'CODE_REJECTED',
        metadata: { phone: maskPhone(phoneE164) },
      }, client);
      throw new BadRequestException('Verification code is invalid or expired.');
    }

    await this.audit.record({
      event: 'CODE_CONSUMED',
      metadata: { phone: maskPhone(phoneE164) },
    }, client);
  }

  private async reserveCode(input: IssueVerificationCodeInput & {
    phoneE164: string;
    targetHash: string;
    now: Date;
  }, tx: Prisma.TransactionClient): Promise<CodeReservation> {
    const [activePhoneCodes, ipReservations, deviceReservations] = await Promise.all([
      tx.verificationCode.count({
        where: {
          targetHash: input.targetHash,
          consumedAt: null,
          createdAt: { gte: new Date(input.now.getTime() - 10 * 60 * 1000) },
          expiresAt: { gt: input.now },
        },
      }),
      this.audit.count(
        'CODE_RESERVATION',
        { ip: input.ip },
        new Date(input.now.getTime() - 60 * 60 * 1000),
        tx,
      ),
      this.audit.count(
        'CODE_RESERVATION',
        { device: input.deviceId },
        new Date(input.now.getTime() - 60 * 60 * 1000),
        tx,
      ),
    ]);

    const limitedBy =
      activePhoneCodes >= 3 ? 'phone' : ipReservations >= 10 ? 'ip' : deviceReservations >= 8 ? 'device' : null;

    if (limitedBy) return { limitedBy };

    const code = await this.uniqueCode(input, tx);
    await tx.verificationCode.create({
      data: {
        purpose: input.purpose,
        targetHash: input.targetHash,
        codeHash: this.hashCode(input.purpose, input.phoneE164, code),
        expiresAt: new Date(input.now.getTime() + 5 * 60 * 1000),
      },
    });

    await this.audit.record({
      event: 'CODE_RESERVATION',
      ip: input.ip,
      device: input.deviceId,
      metadata: { phone: maskPhone(input.phoneE164) },
    }, tx);
    return { code };
  }

  private async reserveWithRetry(input: IssueVerificationCodeInput & {
    phoneE164: string;
    targetHash: string;
    now: Date;
  }): Promise<CodeReservation> {
    for (let attempt = 1; attempt <= RESERVATION_TRANSACTION_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.reserveCode(input, tx),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!isPrismaWriteConflict(error) || attempt === RESERVATION_TRANSACTION_MAX_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new InternalServerErrorException('Could not reserve a verification code.');
  }

  private async uniqueCode(
    input: IssueVerificationCodeInput & { phoneE164: string; targetHash: string; now: Date },
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts += 1) {
      const code = randomInt(100000, 1000000).toString();
      const existing = await tx.verificationCode.findFirst({
        where: {
          purpose: input.purpose,
          targetHash: input.targetHash,
          codeHash: this.hashCode(input.purpose, input.phoneE164, code),
          consumedAt: null,
          expiresAt: { gt: input.now },
        },
      });
      if (!existing) return code;
    }

    throw new InternalServerErrorException('Could not allocate a verification code.');
  }

  private hashTarget(phoneE164: string): string {
    return createHmac('sha256', this.refreshPepper).update(`target:${phoneE164}`).digest('hex');
  }

  private hashCode(purpose: VerificationPurpose, phoneE164: string, code: string): string {
    return createHmac('sha256', this.refreshPepper)
      .update(`${purpose}:${phoneE164}:${code}`)
      .digest('hex');
  }
}

function maskPhone(phoneE164: string): string {
  return `${phoneE164.slice(0, 5)}****${phoneE164.slice(-4)}`;
}

function isPrismaWriteConflict(error: unknown): error is { code: 'P2034' } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2034'
  );
}
