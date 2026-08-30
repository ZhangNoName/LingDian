import { Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@lingdian/db';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthAudience, AuthenticatedUser, AuthRole } from '../../common/auth/authenticated-user.type';
import { AUTH_REFRESH_PEPPER } from './verification.service';
import { AuditService } from './audit.service';

export type SessionUser = {
  id: string;
  sessionVersion: number;
  roles: AuthRole[];
  mustChangePassword?: boolean;
  merchantStoreIds?: string[];
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
};

export type SessionAuditContext = { ip?: string; device?: string };

type AccessTokenClaims = {
  sub: string;
  sid: string;
  aud: AuthAudience;
  sv: number;
  roles: AuthRole[];
  mustChangePassword?: boolean;
  merchantStoreIds?: string[];
};

type SessionWriteClient = PrismaService | Prisma.TransactionClient;
const SESSION_CREATE_MAX_ATTEMPTS = 3;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(AUTH_REFRESH_PEPPER) private readonly refreshPepper: string,
    private readonly config: ConfigService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async create(
    user: SessionUser,
    audience: AuthAudience,
    device: string,
    context: SessionAuditContext = {},
    client: SessionWriteClient = this.prisma,
  ): Promise<SessionTokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
    const dbAudience = toDbAudience(audience);
    const activeDeviceKey = sessionActivityKey(user.id, dbAudience, device);
    let session: { id: string } | undefined;
    for (let attempt = 1; attempt <= SESSION_CREATE_MAX_ATTEMPTS; attempt += 1) {
      const now = new Date();
      await client.authSession.updateMany({
        where: { activeDeviceKey, status: 'ACTIVE' },
        data: { status: 'REVOKED', activeDeviceKey: null, revokedAt: now },
      });
      try {
        session = await client.authSession.create({
          data: {
            userId: user.id,
            audience: dbAudience,
            activeDeviceKey,
            refreshTokenHash: this.hash(refreshToken),
            previousRefreshTokenHash: null,
            refreshTokenHistory: [],
            device,
            expiresAt,
          },
        });
        break;
      } catch (error) {
        if (!isPrismaError(error, 'P2002') || attempt === SESSION_CREATE_MAX_ATTEMPTS) throw error;
      }
    }
    if (!session) throw new Error('Session creation retry limit reached.');
    const authenticatedUser = toAuthenticatedUser(user, session.id, audience);

    const tokens = {
      accessToken: await this.sign(authenticatedUser, user.sessionVersion),
      refreshToken,
      expiresIn: this.accessTokenTtlSeconds,
      user: authenticatedUser,
    };
    await this.audit?.record({ event: 'SESSION_CREATED', userId: user.id, sessionId: session.id, ip: context.ip, device: context.device ?? device, metadata: { audience } }, client);
    return tokens;
  }

  async refresh(rawToken: string, context: SessionAuditContext = {}): Promise<SessionTokens> {
    const rawTokenHash = this.hash(rawToken);
    const currentSession = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: rawTokenHash },
      include: { user: { include: { roles: true } } },
    });
    const session = currentSession ?? await this.prisma.authSession.findFirst({
      where: {
        OR: [
          { previousRefreshTokenHash: rawTokenHash },
          { refreshTokenHistory: { array_contains: [rawTokenHash] } },
        ],
      },
      include: { user: { include: { roles: true } } },
    });

    if (!session || session.status !== 'ACTIVE' || session.expiresAt <= new Date()) {
      await this.audit?.record({ event: 'SESSION_REFRESH_REJECTED', ip: context.ip, device: context.device, metadata: { reason: 'inactive-or-expired' } });
      throw new UnauthorizedException('Session is inactive or expired.');
    }
    if (!currentSession) {
      await this.revoke(session.id, context, 'refresh-token-replay');
      await this.audit?.record({ event: 'SESSION_REFRESH_REJECTED', userId: session.userId, sessionId: session.id, ip: context.ip, device: context.device, metadata: { reason: 'replay' } });
      throw new UnauthorizedException('Refresh token replay detected.');
    }
    if (session.user.status !== 'ACTIVE') {
      await this.audit?.record({ event: 'SESSION_REFRESH_REJECTED', userId: session.userId, sessionId: session.id, ip: context.ip, device: context.device, metadata: { reason: 'user-inactive' } });
      throw new UnauthorizedException('User is inactive.');
    }

    const refreshToken = randomBytes(32).toString('base64url');
    const rotated = await this.prisma.authSession.updateMany({
      where: { id: session.id, status: 'ACTIVE', refreshTokenHash: rawTokenHash, expiresAt: { gt: new Date() } },
      data: {
        refreshTokenHash: this.hash(refreshToken),
        previousRefreshTokenHash: rawTokenHash,
        refreshTokenHistory: appendRefreshTokenHistory(session.refreshTokenHistory, rawTokenHash),
      },
    });
    if (rotated.count !== 1) {
      const replayed = await this.prisma.authSession.findFirst({
        where: {
          OR: [
            { previousRefreshTokenHash: rawTokenHash },
            { refreshTokenHistory: { array_contains: [rawTokenHash] } },
          ],
        },
      });
      if (replayed?.status === 'ACTIVE') await this.revoke(replayed.id, context, 'refresh-token-replay');
      await this.audit?.record({ event: 'SESSION_REFRESH_REJECTED', userId: session.userId, sessionId: session.id, ip: context.ip, device: context.device, metadata: { reason: 'rotation-race-or-replay' } });
      throw new UnauthorizedException('Refresh token replay detected.');
    }

    const audience = fromDbAudience(session.audience);
    const user = toAuthenticatedUser(
      {
        id: session.user.id,
        sessionVersion: session.user.sessionVersion,
        roles: session.user.roles
          .filter((assignment) => assignment.status === 'ACTIVE')
          .map((assignment) => assignment.role),
        ...(session.user.mustChangePassword ? { mustChangePassword: true } : {}),
        merchantStoreIds: activeMerchantStoreIds(session.user.roles),
      },
      session.id,
      audience,
    );

    const tokens = {
      accessToken: await this.sign(user, session.user.sessionVersion),
      refreshToken,
      expiresIn: this.accessTokenTtlSeconds,
      user,
    };
    await this.audit?.record({ event: 'SESSION_REFRESHED', userId: session.userId, sessionId: session.id, ip: context.ip, device: context.device ?? session.device, metadata: { audience } });
    return tokens;
  }

  async revoke(sessionId: string, context: SessionAuditContext = {}, reason = 'logout'): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, status: 'ACTIVE' },
      data: { status: 'REVOKED', activeDeviceKey: null, revokedAt: new Date() },
    });
    await this.audit?.record({ event: 'SESSION_REVOKED', sessionId, ip: context.ip, device: context.device, metadata: { reason } });
  }

  async revokeAll(userId: string, context: SessionAuditContext = {}): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'REVOKED', activeDeviceKey: null, revokedAt: now },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } }),
    ]);
    await this.audit?.record({ event: 'SESSION_REVOKED_ALL', userId, ip: context.ip, device: context.device });
  }

  private async sign(user: AuthenticatedUser, sessionVersion: number): Promise<string> {
    const claims: AccessTokenClaims = {
      sub: user.userId,
      sid: user.sessionId,
      aud: user.audience,
      sv: sessionVersion,
      roles: user.roles,
      ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
      ...(user.merchantStoreIds?.length ? { merchantStoreIds: user.merchantStoreIds } : {}),
    };
    return this.jwt.signAsync(claims, { expiresIn: this.accessTokenTtlSeconds });
  }

  private hash(rawToken: string): string {
    return createHmac('sha256', this.refreshPepper).update(rawToken).digest('hex');
  }

  private get accessTokenTtlSeconds(): number {
    return this.config.get<number>('auth.accessTokenTtlSeconds', 900);
  }

  private get refreshTokenTtlDays(): number {
    return this.config.get<number>('auth.refreshTokenTtlDays', 30);
  }
}

function toAuthenticatedUser(user: SessionUser, sessionId: string, audience: AuthAudience): AuthenticatedUser {
  return {
    userId: user.id,
    sessionId,
    audience,
    roles: user.roles,
    ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
    ...(audience === 'merchant-api' && user.merchantStoreIds?.length
      ? { merchantStoreIds: normalizeStoreIds(user.merchantStoreIds) }
      : {}),
  };
}

function activeMerchantStoreIds(
  roles: Array<{ role: AuthRole; status?: string; scopeType?: string; scopeId?: string }>,
): string[] {
  return normalizeStoreIds(roles
    .filter((assignment) => assignment.status === 'ACTIVE' && assignment.role === 'MERCHANT' && assignment.scopeType === 'STORE')
    .map((assignment) => assignment.scopeId ?? ''));
}

function normalizeStoreIds(storeIds: string[]): string[] {
  return [...new Set(storeIds.map((storeId) => storeId.trim()).filter(Boolean))].sort();
}

function toDbAudience(audience: AuthAudience): 'USER_API' | 'ADMIN_API' | 'MERCHANT_API' {
  if (audience === 'user-api') return 'USER_API';
  if (audience === 'admin-api') return 'ADMIN_API';
  return 'MERCHANT_API';
}

function fromDbAudience(audience: 'USER_API' | 'ADMIN_API' | 'MERCHANT_API'): AuthAudience {
  if (audience === 'USER_API') return 'user-api';
  if (audience === 'ADMIN_API') return 'admin-api';
  return 'merchant-api';
}

function appendRefreshTokenHistory(history: unknown, tokenHash: string): string[] {
  const previous = Array.isArray(history) ? history.filter((value): value is string => typeof value === 'string') : [];
  const next = previous.includes(tokenHash) ? previous : [...previous, tokenHash];
  return next.slice(-32);
}

function sessionActivityKey(
  userId: string,
  audience: 'USER_API' | 'ADMIN_API' | 'MERCHANT_API',
  device: string,
): string {
  return createHash('sha256').update(userId).update('\0').update(audience).update('\0').update(device).digest('hex');
}

function isPrismaError(error: unknown, code: 'P2002'): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
