import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthAudience, AuthenticatedUser, AuthRole } from './authenticated-user.type';

type AccessTokenClaims = {
  sub?: unknown;
  sid?: unknown;
  aud?: unknown;
  sv?: unknown;
  roles?: unknown;
  merchantStoreIds?: unknown;
  mustChangePassword?: unknown;
};

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers?: { authorization?: string }; user?: AuthenticatedUser }>();
    const token = bearerToken(request.headers?.authorization);

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.getOrThrow<string>('auth.jwtAccessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired.');
    }

    const user = validateClaims(claims);
    const session = await this.prisma.authSession.findUnique({
      where: { id: user.sessionId },
      include: { user: { select: { status: true, sessionVersion: true } } },
    });
    if (
      !session ||
      session.status !== 'ACTIVE' ||
      session.expiresAt <= new Date() ||
      session.userId !== user.userId ||
      fromDbAudience(session.audience) !== user.audience ||
      session.user.status !== 'ACTIVE' ||
      session.user.sessionVersion !== claims.sv
    ) {
      throw new UnauthorizedException('Access token session is no longer active.');
    }

    request.user = user;
    return true;
  }
}

function bearerToken(authorization: string | undefined): string {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new UnauthorizedException('Bearer access token is required.');
  return match[1];
}

function validateClaims(claims: AccessTokenClaims): AuthenticatedUser {
  if (
    typeof claims.sub !== 'string' ||
    typeof claims.sid !== 'string' ||
    (claims.aud !== 'user-api' && claims.aud !== 'admin-api' && claims.aud !== 'merchant-api') ||
    !Number.isInteger(claims.sv) ||
    !Array.isArray(claims.roles) ||
    claims.roles.some((role) => role !== 'USER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'MERCHANT') ||
    !validMerchantStoreIds(claims.merchantStoreIds, claims.aud) ||
    (claims.mustChangePassword !== undefined && typeof claims.mustChangePassword !== 'boolean')
  ) {
    throw new UnauthorizedException('Access token claims are invalid.');
  }

  return {
    userId: claims.sub,
    sessionId: claims.sid,
    audience: claims.aud,
    roles: claims.roles as AuthRole[],
    ...(claims.mustChangePassword === true ? { mustChangePassword: true } : {}),
    ...(Array.isArray(claims.merchantStoreIds) && claims.merchantStoreIds.length > 0
      ? { merchantStoreIds: claims.merchantStoreIds as string[] }
      : {}),
  };
}

function validMerchantStoreIds(value: unknown, audience: unknown): boolean {
  return value === undefined || (
    audience === 'merchant-api' &&
    Array.isArray(value) &&
    value.every((storeId) => typeof storeId === 'string' && storeId.trim().length > 0) &&
    new Set(value).size === value.length
  );
}

function fromDbAudience(audience: 'USER_API' | 'ADMIN_API' | 'MERCHANT_API'): AuthAudience {
  if (audience === 'USER_API') return 'user-api';
  if (audience === 'ADMIN_API') return 'admin-api';
  return 'merchant-api';
}
