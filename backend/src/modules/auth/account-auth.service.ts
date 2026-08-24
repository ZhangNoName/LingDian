import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AccountLoginRequest, AuthenticatedUser, PasswordResetRequest } from '@lingdian/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditContext, AuditService } from './audit.service';
import { AuthRequestContext } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService, SessionTokens } from './session.service';
import { VerificationService } from './verification.service';

type PasswordForgotInput = Pick<PasswordResetRequest, 'username' | 'audience'>;
type PasswordChangeInput = Pick<PasswordResetRequest, 'code' | 'password'>;
type CurrentPasswordChangeInput = { currentPassword: string; password: string };

// A valid, fixed scrypt encoding makes rejected account lookups consume the
// same expensive password-verification path as an incorrect real password.
const DUMMY_PASSWORD_HASH = 'scrypt$32768$8$1$MDEyMzQ1Njc4OWFiY2RlZg$MhOAyiW9x5caUyZmfiSPDbUopudTbzEvoisRTRmP7gjZXJeGfyPKoUc23hf-Vga7p5_ApYg75z-MZOw-SAf1Sw';

type AccountIdentity = {
  id: string;
  passwordCredential: { passwordHash: string } | null;
  user: AccountUser;
};

type AccountUser = {
  id: string;
  status: 'ACTIVE' | 'DISABLED';
  sessionVersion: number;
  mustChangePassword: boolean;
  roles: Array<{ role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'MERCHANT'; scopeType: string; scopeId: string; status: 'ACTIVE' | 'DISABLED' }>;
  identities: Array<{ id: string; provider: 'PHONE' | 'WECHAT' | 'QQ' | 'ACCOUNT'; phoneE164: string | null; verifiedAt: Date | null }>;
};

@Injectable()
export class AccountAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verification: VerificationService,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async login(input: AccountLoginRequest, context: AuthRequestContext): Promise<SessionTokens> {
    try {
      const username = normalizeAccountName(input.username);
      const account = await this.findAccount(username);
      const credential = account?.passwordCredential;
      if (!account || !credential || !isEligibleForAudience(account.user, input.audience)) {
        await this.passwords.verify(input.password, DUMMY_PASSWORD_HASH);
        throw invalidCredentials();
      }
      if (!await this.passwords.verify(input.password, credential.passwordHash)) {
        throw invalidCredentials();
      }

      await this.prisma.user.update({ where: { id: account.user.id }, data: { lastLoginAt: new Date() } });

      const tokens = await this.sessions.create(
        {
          id: account.user.id,
          sessionVersion: account.user.sessionVersion,
          roles: activeRoles(account.user),
          ...(account.user.mustChangePassword ? { mustChangePassword: true } : {}),
          merchantStoreIds: activeMerchantStoreIds(account.user),
        },
        input.audience,
        context.deviceId,
        context,
      );
      await this.audit.record({
        event: 'ACCOUNT_LOGIN_SUCCEEDED', userId: account.user.id, sessionId: tokens.user.sessionId,
        ip: context.ip, device: context.deviceId, metadata: { audience: input.audience },
      });
      return tokens;
    } catch (error) {
      await this.audit.record({
        event: 'ACCOUNT_LOGIN_REJECTED', ip: context.ip, device: context.deviceId,
        metadata: { audience: input.audience, reason: error instanceof Error ? error.name : 'unknown' },
      });
      throw error;
    }
  }

  async requestPasswordReset(input: PasswordForgotInput, context: AuthRequestContext): Promise<{ accepted: true }> {
    try {
      const account = await this.findMerchantAccount(normalizeAccountName(input.username));
      const phone = verifiedPhone(account?.user);
      if (!account || !phone) {
        await this.audit.record({
          event: 'PASSWORD_RESET_REJECTED', ip: context.ip, device: context.deviceId,
          metadata: { reason: 'account-not-eligible' },
        });
        return { accepted: true };
      }

      await this.verification.issue({ purpose: 'PASSWORD_RESET', phone, ip: context.ip ?? 'unknown', deviceId: context.deviceId });
      await this.audit.record({ event: 'PASSWORD_RESET_REQUESTED', userId: account.user.id, ip: context.ip, device: context.deviceId });
    } catch (error) {
      await this.audit.record({
        event: 'PASSWORD_RESET_REJECTED', ip: context.ip, device: context.deviceId,
        metadata: { reason: error instanceof Error ? error.name : 'unknown' },
      });
    }

    return { accepted: true };
  }

  async resetPassword(input: PasswordResetRequest, context: AuthRequestContext): Promise<void> {
    try {
      const account = await this.findMerchantAccount(normalizeAccountName(input.username));
      if (!account) throw invalidPasswordReset();
      await this.performPasswordReset(account, input.code, input.password, context, 'PASSWORD_RESET_SUCCEEDED');
    } catch (error) {
      await this.audit.record({
        event: 'PASSWORD_RESET_REJECTED', ip: context.ip, device: context.deviceId,
        metadata: { reason: error instanceof Error ? error.name : 'unknown' },
      });
      throw error;
    }
  }

  async requestPasswordChangeCode(user: AuthenticatedUser, context: AuthRequestContext): Promise<{ accepted: true }> {
    try {
      const account = await this.findCurrentMerchantAccount(user);
      const phone = verifiedPhone(account.user);
      if (!phone) throw new ForbiddenException('A verified merchant phone identity is required.');
      await this.verification.issue({ purpose: 'PASSWORD_RESET', phone, ip: context.ip ?? 'unknown', deviceId: context.deviceId });
      await this.audit.record({ event: 'PASSWORD_CHANGE_CODE_SENT', userId: account.user.id, ip: context.ip, device: context.deviceId });
      return { accepted: true };
    } catch (error) {
      await this.audit.record({
        event: 'PASSWORD_CHANGE_REJECTED', userId: user.userId, ip: context.ip, device: context.deviceId,
        metadata: { reason: error instanceof Error ? error.name : 'unknown' },
      });
      throw error;
    }
  }

  async changePassword(user: AuthenticatedUser, input: PasswordChangeInput, context: AuthRequestContext): Promise<void> {
    try {
      const account = await this.findCurrentMerchantAccount(user);
      await this.performPasswordReset(account, input.code, input.password, context, 'PASSWORD_CHANGE_SUCCEEDED');
    } catch (error) {
      await this.audit.record({
        event: 'PASSWORD_CHANGE_REJECTED', userId: user.userId, ip: context.ip, device: context.deviceId,
        metadata: { reason: error instanceof Error ? error.name : 'unknown' },
      });
      throw error;
    }
  }

  async changeCurrentPassword(user: AuthenticatedUser, input: CurrentPasswordChangeInput, context: AuthRequestContext): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: { identities: { include: { passwordCredential: true } } },
    }) as unknown as { identities: Array<{ id: string; provider: string; passwordCredential: { passwordHash: string } | null }> } | null;
    const account = current?.identities.find((identity) => identity.provider === 'ACCOUNT' && identity.passwordCredential);
    if (!account?.passwordCredential || !await this.passwords.verify(input.currentPassword, account.passwordCredential.passwordHash)) {
      throw new UnauthorizedException('Current password is invalid.');
    }
    await this.passwords.replace(account.id, input.password, user.userId, context);
    await this.prisma.user.update({ where: { id: user.userId }, data: { mustChangePassword: false } });
    await this.audit.record({ event: 'CURRENT_PASSWORD_CHANGED', userId: user.userId, sessionId: user.sessionId, ip: context.ip, device: context.deviceId });
  }

  private async performPasswordReset(
    account: AccountIdentity,
    code: string,
    password: string,
    context: AuthRequestContext,
    event: 'PASSWORD_RESET_SUCCEEDED' | 'PASSWORD_CHANGE_SUCCEEDED',
  ): Promise<void> {
    const phone = verifiedPhone(account.user);
    if (!phone) throw invalidPasswordReset();
    await this.verification.consume({ purpose: 'PASSWORD_RESET', phone, code });
    await this.passwords.replace(account.id, password, account.user.id, context);
    await this.prisma.user.update({ where: { id: account.user.id }, data: { mustChangePassword: false } });
    await this.audit.record({ event, userId: account.user.id, ip: context.ip, device: context.deviceId });
  }

  private async findAccount(username: string): Promise<AccountIdentity | null> {
    return this.prisma.authIdentity.findUnique({
      where: { provider_subject: { provider: 'ACCOUNT', subject: username } },
      include: {
        passwordCredential: true,
        user: { include: { roles: true, identities: { where: { provider: 'PHONE' } } } },
      },
    }) as Promise<AccountIdentity | null>;
  }

  private async findMerchantAccount(username: string): Promise<AccountIdentity | null> {
    const account = await this.findAccount(username);
    return account && isEligibleForAudience(account.user, 'merchant-api') ? account : null;
  }

  private async findCurrentMerchantAccount(user: AuthenticatedUser): Promise<AccountIdentity> {
    if (user.audience !== 'merchant-api' || !user.roles.includes('MERCHANT')) {
      throw new ForbiddenException('Merchant audience required.');
    }
    const accountUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: { roles: true, identities: true },
    }) as AccountUser | null;
    if (!accountUser || !isEligibleForAudience(accountUser, 'merchant-api')) {
      throw new ForbiddenException('Active store-scoped merchant role required.');
    }
    const accountIdentity = accountUser.identities.find((identity) => identity.provider === 'ACCOUNT');
    if (!accountIdentity) throw new ForbiddenException('Merchant account identity is required.');
    return { id: accountIdentity.id, passwordCredential: null, user: accountUser };
  }
}

function normalizeAccountName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(normalized)) {
    throw new BadRequestException('Account name must use 3-64 lowercase letters, digits, dots, underscores, or hyphens.');
  }
  return normalized;
}

function isEligibleForAudience(user: AccountUser, audience: AccountLoginRequest['audience']): boolean {
  if (user.status !== 'ACTIVE') return false;
  if (audience === 'admin-api') return user.roles.some((role) => role.status === 'ACTIVE' && (role.role === 'ADMIN' || role.role === 'SUPER_ADMIN'));
  return user.roles.some(
    (role) => role.status === 'ACTIVE' && role.role === 'MERCHANT' && role.scopeType === 'STORE' && role.scopeId.length > 0,
  );
}

function activeRoles(user: AccountUser): Array<'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'MERCHANT'> {
  return [...new Set(user.roles.filter((role) => role.status === 'ACTIVE').map((role) => role.role))];
}

function activeMerchantStoreIds(user: AccountUser): string[] {
  return [...new Set(user.roles
    .filter((role) => role.status === 'ACTIVE' && role.role === 'MERCHANT' && role.scopeType === 'STORE')
    .map((role) => role.scopeId.trim())
    .filter(Boolean))].sort();
}

function verifiedPhone(user: AccountUser | undefined): string | null {
  return user?.identities.find((identity) => identity.provider === 'PHONE' && identity.verifiedAt && identity.phoneE164)?.phoneE164 ?? null;
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException('Account credentials are invalid.');
}

function invalidPasswordReset(): BadRequestException {
  return new BadRequestException('Verification code is invalid or expired.');
}
