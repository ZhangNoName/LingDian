import { ForbiddenException, Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { PhoneLoginRequest } from '@lingdian/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthRole } from '../../common/auth/authenticated-user.type';
import { normalizeChinesePhone } from './phone';
import { SessionService, SessionTokens } from './session.service';
import { VerificationService } from './verification.service';
import { AuditService } from './audit.service';
import { LegalConsentService } from './legal-consent.service';

export type AuthRequestContext = {
  deviceId: string;
  ip?: string;
};

type AuthUser = {
  id: string;
  status: 'ACTIVE' | 'DISABLED';
  sessionVersion: number;
  roles: Array<{ role: AuthRole; status: 'ACTIVE' | 'DISABLED' }>;
};

const PHONE_USER_TRANSACTION_MAX_ATTEMPTS = 3;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verification: VerificationService,
    private readonly sessions: SessionService,
    @Optional() @Inject(AuditService) private readonly audit: AuditService | undefined,
    private readonly legalConsent: LegalConsentService,
  ) {}

  async phoneLogin(input: PhoneLoginRequest, context: AuthRequestContext): Promise<SessionTokens> {
    try {
      this.legalConsent.assertCurrentForAudience(input.audience, input.legalConsent);
      const purpose = input.audience === 'admin-api' ? 'ADMIN_LOGIN' : 'PHONE_LOGIN';
      await this.verification.consume({ purpose, phone: input.phone, code: input.code });

      const phoneE164 = normalizeChinesePhone(input.phone);
      return await this.createPhoneLoginSession(phoneE164, input, context);
    } catch (error) {
      await this.audit?.record({ event: 'PHONE_LOGIN_REJECTED', ip: context.ip, device: context.deviceId, metadata: { audience: input.audience, phone: maskPhone(input.phone), reason: error instanceof Error ? error.name : 'unknown' } });
      throw error;
    }
  }

  private async createPhoneLoginSession(
    phoneE164: string,
    input: PhoneLoginRequest,
    context: AuthRequestContext,
  ): Promise<SessionTokens> {
    for (let attempt = 1; attempt <= PHONE_USER_TRANSACTION_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.createPhoneLoginSessionInTransaction(tx, phoneE164, input, context),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          (isPrismaError(error, 'P2002') || isPrismaError(error, 'P2034')) &&
          attempt < PHONE_USER_TRANSACTION_MAX_ATTEMPTS
        ) continue;
        throw error;
      }
    }

    throw new Error('Phone-user transaction retry limit reached.');
  }

  private async createPhoneLoginSessionInTransaction(
    tx: Prisma.TransactionClient,
    phoneE164: string,
    input: PhoneLoginRequest,
    context: AuthRequestContext,
  ): Promise<SessionTokens> {
    const existingUser = await this.findPhoneUser(tx, phoneE164);
    let user = existingUser;

    if (!user) {
      if (input.audience === 'admin-api') {
        throw new ForbiddenException('Administrator role required.');
      }

      user = await tx.user.create({
        data: {
          identities: {
            create: { provider: 'PHONE', subject: phoneE164, phoneE164, verifiedAt: new Date() },
          },
          roles: { create: { role: 'USER' } },
        },
        include: { roles: true },
      });
    }

    const roles = activeRoles(user);
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('User is inactive.');
    if (input.audience === 'admin-api' && !roles.includes('ADMIN')) {
      throw new ForbiddenException('Administrator role required.');
    }

    if (input.audience === 'user-api') {
      await this.legalConsent.record(user.id, input.legalConsent!, context, tx);
    }
    const tokens = await this.sessions.create(
      { id: user.id, sessionVersion: user.sessionVersion, roles },
      input.audience,
      context.deviceId,
      context,
      tx,
    );
    await this.audit?.record({
      event: 'PHONE_LOGIN_SUCCEEDED',
      userId: user.id,
      sessionId: tokens.user.sessionId,
      ip: context.ip,
      device: context.deviceId,
      metadata: {
        audience: input.audience,
        phone: maskPhone(input.phone),
        loginMethod: 'PHONE_VERIFICATION_CODE',
        ...(input.legalConsent ? {
          userAgreementVersion: input.legalConsent.userAgreementVersion,
          privacyPolicyVersion: input.legalConsent.privacyPolicyVersion,
        } : {}),
      },
    }, tx);
    return tokens;
  }

  private async findPhoneUser(
    client: PrismaService | Prisma.TransactionClient,
    phoneE164: string,
  ): Promise<AuthUser | null> {
    const identity = await client.authIdentity.findUnique({
      where: { provider_subject: { provider: 'PHONE', subject: phoneE164 } },
      include: { user: { include: { roles: true } } },
    });
    if (identity) return identity.user;
    return null;
  }
}

function maskPhone(phone: string): string {
  return phone.length < 5 ? '***' : `${phone.slice(0, 3)}****${phone.slice(-2)}`;
}

function activeRoles(user: AuthUser): AuthRole[] {
  return user.roles.filter((assignment) => assignment.status === 'ACTIVE').map((assignment) => assignment.role);
}

function isPrismaError(error: unknown, code: 'P2002' | 'P2034'): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
}
