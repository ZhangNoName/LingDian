import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthRole } from '../../common/auth/authenticated-user.type';
import { AuditService } from './audit.service';
import { normalizeChinesePhone } from './phone';
import { OAUTH_PROVIDERS, OAuthProvider } from './providers/oauth-provider';
import { AUTH_REFRESH_PEPPER, VerificationService } from './verification.service';

const PENDING_OAUTH_TTL_MS = 10 * 60 * 1000;
const STATE_PLACEHOLDER_SUBJECT = '__oauth_state__';
const IDENTITY_TRANSACTION_MAX_ATTEMPTS = 3;

type OAuthUser = {
  id: string;
  status: 'ACTIVE' | 'DISABLED';
  sessionVersion: number;
  roles: Array<{ role: AuthRole; status: 'ACTIVE' | 'DISABLED' }>;
};

type PendingIdentity = { id: string; provider: 'WECHAT' | 'QQ'; subject: string };

@Injectable()
export class OAuthService {
  private readonly providers: Map<'WECHAT' | 'QQ', OAuthProvider>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OAUTH_PROVIDERS) providers: OAuthProvider[],
    private readonly verification: VerificationService,
    private readonly audit: AuditService,
    @Inject(AUTH_REFRESH_PEPPER) private readonly refreshPepper: string = 'test-refresh-pepper',
  ) {
    this.providers = new Map(providers.map((provider) => [provider.provider, provider]));
  }

  async start(input: { provider: string; audience: string; ip?: string; device?: string }): Promise<{ authorizationUrl: string }> {
    try {
      const provider = this.provider(input.provider);
      this.requireUserAudience(input.audience);
      const state = randomBytes(32).toString('base64url');
      const now = new Date();
      await this.prisma.pendingOAuth.create({
        data: {
          provider: provider.provider,
          subject: STATE_PLACEHOLDER_SUBJECT,
          stateHash: this.hashState(state),
          audience: 'USER_API',
          providerMetadataEncrypted: this.encryptMetadata({}),
          expiresAt: new Date(now.getTime() + PENDING_OAUTH_TTL_MS),
        },
      });
      await this.audit.record({ event: 'OAUTH_START', ip: input.ip, device: input.device, metadata: { provider: provider.provider } });
      return { authorizationUrl: provider.buildAuthorizationUrl({ state, redirectUri: provider.redirectUri }) };
    } catch (error) {
      await this.audit.record({ event: 'OAUTH_START_REJECTED', ip: input.ip, device: input.device, metadata: { provider: input.provider } });
      throw error;
    }
  }

  async callback(input: { provider: string; code: string; state: string; audience: string; ip?: string; device?: string }): Promise<{ pendingOauthId: string; expiresIn: number }> {
    try {
      const provider = this.provider(input.provider);
      this.requireUserAudience(input.audience);
      const now = new Date();
      const stateRecord = await this.prisma.pendingOAuth.findFirst({
        where: {
          provider: provider.provider,
          subject: STATE_PLACEHOLDER_SUBJECT,
          stateHash: this.hashState(input.state),
          audience: 'USER_API',
          consumedAt: null,
          expiresAt: { gt: now },
        },
      });
      if (!stateRecord) throw new BadRequestException('OAuth state is invalid or expired.');
      const consumed = await this.prisma.pendingOAuth.updateMany({
        data: { consumedAt: now },
        where: { id: stateRecord.id, consumedAt: null, expiresAt: { gt: now } },
      });
      if (consumed.count !== 1) throw new BadRequestException('OAuth state is invalid or expired.');

      const profile = await provider.exchange({ code: input.code, redirectUri: provider.redirectUri });
      const pending = await this.createPendingBinding(provider, profile, now);
      await this.audit.record({ event: 'OAUTH_CALLBACK_PENDING', ip: input.ip, device: input.device, metadata: { provider: provider.provider } });
      return { pendingOauthId: pending.id, expiresIn: PENDING_OAUTH_TTL_MS / 1000 };
    } catch (error) {
      await this.audit.record({ event: 'OAUTH_CALLBACK_REJECTED', ip: input.ip, device: input.device, metadata: { provider: input.provider } });
      throw error;
    }
  }

  async miniProgramCallback(input: { provider: string; code: string; audience: string; ip?: string; device?: string }): Promise<{ pendingOauthId: string; expiresIn: number }> {
    try {
      const provider = this.provider(input.provider);
      this.requireUserAudience(input.audience);
      const profile = await provider.exchangeMiniProgramCode({ code: input.code });
      const pending = await this.createPendingBinding(provider, profile, new Date(), provider.miniProgramAppId);
      await this.audit.record({ event: 'OAUTH_MINIAPP_CALLBACK_PENDING', ip: input.ip, device: input.device, metadata: { provider: provider.provider } });
      return { pendingOauthId: pending.id, expiresIn: PENDING_OAUTH_TTL_MS / 1000 };
    } catch (error) {
      await this.audit.record({ event: 'OAUTH_MINIAPP_CALLBACK_REJECTED', ip: input.ip, device: input.device, metadata: { provider: input.provider } });
      throw error;
    }
  }

  async linkPhone(input: { pendingOauthId: string; phone: string; code: string }): Promise<OAuthUser> {
    try {
      const phoneE164 = normalizeChinesePhone(input.phone);
      const user = await this.transactionWithRetry(async (tx) => {
        await this.verification.consume({ purpose: 'PHONE_LINK', phone: input.phone, code: input.code }, tx);
        return this.consumePendingIntoPhoneUser(tx, input.pendingOauthId, phoneE164);
      });
      await this.audit.record({ event: 'OAUTH_PHONE_LINKED', userId: user.id });
      return user;
    } catch (error) {
      await this.audit.record({ event: 'OAUTH_PHONE_LINK_REJECTED' });
      throw error;
    }
  }

  async bindPendingIdentity(input: { userId: string; provider: string; pendingOauthId: string; phone: string; code: string }): Promise<void> {
    try {
      const provider = this.provider(input.provider);
      const phoneE164 = normalizeChinesePhone(input.phone);
      await this.transactionWithRetry(async (tx) => {
        await this.verification.consume({ purpose: 'PHONE_LINK', phone: input.phone, code: input.code }, tx);
        const phoneIdentity = await tx.authIdentity.findUnique({
          where: { provider_subject: { provider: 'PHONE', subject: phoneE164 } },
        });
        if (!phoneIdentity || phoneIdentity.userId !== input.userId) {
          throw new ForbiddenException('Recent phone verification must belong to the current user.');
        }
        const pending = await this.claimPending(tx, input.pendingOauthId, provider.provider);
        await this.linkIdentityInTransaction(tx, { userId: input.userId, provider: pending.provider, subject: pending.subject });
      });
      await this.audit.record({ event: 'IDENTITY_BOUND', userId: input.userId, metadata: { provider: provider.provider } });
    } catch (error) {
      await this.audit.record({ event: 'IDENTITY_BIND_REJECTED', userId: input.userId, metadata: { provider: input.provider } });
      throw error;
    }
  }

  async linkIdentity(input: { userId: string; provider: 'WECHAT' | 'QQ'; subject: string }): Promise<void> {
    try {
      await this.linkIdentityInTransaction(this.prisma, input);
      await this.audit.record({ event: 'IDENTITY_LINKED', userId: input.userId, metadata: { provider: input.provider } });
    } catch (error) {
      await this.audit.record({ event: 'IDENTITY_LINK_REJECTED', userId: input.userId, metadata: { provider: input.provider } });
      throw error;
    }
  }

  async unlinkIdentity(input: { userId: string; identityId: string; phone: string; code: string }): Promise<void> {
    try {
      const phoneE164 = normalizeChinesePhone(input.phone);
      await this.transactionWithRetry(async (tx) => {
        await this.verification.consume({ purpose: 'PHONE_LINK', phone: input.phone, code: input.code }, tx);
        const phoneIdentity = await tx.authIdentity.findUnique({ where: { provider_subject: { provider: 'PHONE', subject: phoneE164 } } });
        if (!phoneIdentity || phoneIdentity.userId !== input.userId) {
          throw new ForbiddenException('Recent phone verification must belong to the current user.');
        }
        const identity = await tx.authIdentity.findUnique({ where: { id: input.identityId } });
        if (!identity || identity.userId !== input.userId) throw new NotFoundException('Identity not found.');
        if (identity.provider === 'PHONE') {
          const phoneCount = await tx.authIdentity.count({ where: { userId: input.userId, provider: 'PHONE' } });
          if (phoneCount <= 1) throw new BadRequestException('Cannot delete the final phone identity.');
        }
        await tx.authIdentity.delete({ where: { id: identity.id } });
      });
      await this.audit.record({ event: 'IDENTITY_UNLINKED', userId: input.userId });
    } catch (error) {
      await this.audit.record({ event: 'IDENTITY_UNLINK_REJECTED', userId: input.userId });
      throw error;
    }
  }

  private async consumePendingIntoPhoneUser(tx: Prisma.TransactionClient, pendingOauthId: string, phoneE164: string): Promise<OAuthUser> {
    const pending = await this.claimPending(tx, pendingOauthId);
    let phoneIdentity = await tx.authIdentity.findUnique({
      where: { provider_subject: { provider: 'PHONE', subject: phoneE164 } },
      include: { user: { include: { roles: true } } },
    });
    if (!phoneIdentity) {
      const user = await tx.user.create({
        data: { identities: { create: { provider: 'PHONE', subject: phoneE164, phoneE164, verifiedAt: new Date() } }, roles: { create: { role: 'USER' } } },
        include: { roles: true },
      });
      await this.linkIdentityInTransaction(tx, { userId: user.id, provider: pending.provider, subject: pending.subject });
      return user;
    }
    if (phoneIdentity.user.status !== 'ACTIVE') throw new UnauthorizedException('User is inactive.');
    await this.linkIdentityInTransaction(tx, { userId: phoneIdentity.userId, provider: pending.provider, subject: pending.subject });
    return phoneIdentity.user;
  }

  private async claimPending(tx: Prisma.TransactionClient, pendingOauthId: string, expectedProvider?: 'WECHAT' | 'QQ'): Promise<PendingIdentity> {
    const now = new Date();
    const pending = await tx.pendingOAuth.findFirst({
      where: { id: pendingOauthId, audience: 'USER_API', consumedAt: null, expiresAt: { gt: now } },
    });
    if (!pending || pending.subject === STATE_PLACEHOLDER_SUBJECT || (expectedProvider && pending.provider !== expectedProvider)) {
      throw new BadRequestException('Pending OAuth binding is invalid or expired.');
    }
    const result = await tx.pendingOAuth.updateMany({ data: { consumedAt: now }, where: { id: pending.id, consumedAt: null, expiresAt: { gt: now } } });
    if (result.count !== 1) throw new BadRequestException('Pending OAuth binding is invalid or expired.');
    return pending as PendingIdentity;
  }

  private async linkIdentityInTransaction(
    client: Pick<PrismaService, 'authIdentity'> | Prisma.TransactionClient,
    input: { userId: string; provider: 'WECHAT' | 'QQ'; subject: string },
  ): Promise<void> {
    const existing = await client.authIdentity.findUnique({ where: { provider_subject: { provider: input.provider, subject: input.subject } } });
    if (existing) {
      if (existing.userId !== input.userId) throw new ConflictException('Identity already linked to another user.');
      return;
    }
    try {
      await client.authIdentity.create({ data: { userId: input.userId, provider: input.provider, subject: input.subject, verifiedAt: new Date() } });
    } catch (error) {
      if (!isPrismaUniqueConflict(error)) throw error;
      const raced = await client.authIdentity.findUnique({ where: { provider_subject: { provider: input.provider, subject: input.subject } } });
      if (raced?.userId !== input.userId) throw new ConflictException('Identity already linked to another user.');
    }
  }

  private async transactionWithRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= IDENTITY_TRANSACTION_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < IDENTITY_TRANSACTION_MAX_ATTEMPTS) continue;
        throw error;
      }
    }
    throw new Error('Identity transaction retry limit reached.');
  }

  private provider(value: string): OAuthProvider {
    const provider = this.providers.get(value.toUpperCase() as 'WECHAT' | 'QQ');
    if (!provider) throw new BadRequestException('Unsupported OAuth provider.');
    return provider;
  }

  private requireUserAudience(audience: string): asserts audience is 'user-api' {
    if (audience !== 'user-api') throw new ForbiddenException('OAuth is only available to the user API audience.');
  }

  private async createPendingBinding(
    provider: OAuthProvider,
    profile: Awaited<ReturnType<OAuthProvider['exchange']>>,
    now: Date,
    subjectAppId = provider.appId,
  ) {
    const subject = provider.provider === 'WECHAT' && profile.unionId
      ? profile.unionId
      : `${subjectAppId}:${profile.openId}`;
    return this.prisma.pendingOAuth.create({
      data: {
        provider: provider.provider,
        subject,
        stateHash: this.hashState(randomBytes(32).toString('base64url')),
        audience: 'USER_API',
        providerMetadataEncrypted: this.encryptMetadata({ displayName: profile.displayName ?? '' }),
        expiresAt: new Date(now.getTime() + PENDING_OAUTH_TTL_MS),
      },
    });
  }

  private hashState(state: string): string {
    return createHmac('sha256', this.refreshPepper).update(`oauth-state:${state}`).digest('hex');
  }

  private encryptMetadata(metadata: Record<string, string>): string {
    const key = createHash('sha256').update(this.refreshPepper).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(metadata), 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
  }
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}

function isRetryableTransactionError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    ((error as { code?: unknown }).code === 'P2034' || (error as { code?: unknown }).code === 'P2002');
}
