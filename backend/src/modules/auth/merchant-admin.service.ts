import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { CreateMerchantRequest, MerchantSummary } from '@lingdian/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { normalizeChinesePhone } from './phone';
import { PasswordService } from './password.service';
import { StoreContextResolver } from '../stores/store-context.resolver';

export type UpdateMerchantInput = {
  enabled?: boolean;
  storeIds?: string[];
};

const MERCHANT_TRANSACTION_MAX_ATTEMPTS = 3;

type MerchantUser = Prisma.UserGetPayload<{
  include: { identities: true; roles: true };
}>;

@Injectable()
export class MerchantAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly stores: StoreContextResolver,
  ) {}

  async create(input: CreateMerchantRequest): Promise<MerchantSummary> {
    const username = normalizeAccountName(input.username);
    const phone = normalizeChinesePhone(input.phone);
    const storeIds = this.stores.resolveStoreIds(normalizeStoreIds(input.storeIds));
    const passwordHash = await this.passwords.hash(input.password);

    try {
      return await this.runSerializable(async (tx) => {
        await assertStoresExist(tx, storeIds);
        const user = await tx.user.create({
          data: {
            identities: {
              create: [
                {
                  provider: 'ACCOUNT', subject: username, accountName: username,
                  passwordCredential: { create: { passwordHash } },
                },
                { provider: 'PHONE', subject: phone, phoneE164: phone, verifiedAt: new Date() },
              ],
            },
            roles: {
              create: storeIds.map((scopeId) => ({ role: 'MERCHANT', scopeType: 'STORE', scopeId })),
            },
          },
          include: { identities: true, roles: true },
        });
        await this.audit.record({ event: 'MERCHANT_CREATED', userId: user.id, metadata: { storeCount: storeIds.length } }, tx);
        return merchantSummary(user);
      });
    } catch (error) {
      if (isPrismaUniqueError(error)) throw new ConflictException('Merchant account or phone already exists.');
      throw error;
    }
  }

  async list(): Promise<MerchantSummary[]> {
    const accounts = await this.prisma.authIdentity.findMany({
      where: { provider: 'ACCOUNT', user: { roles: { some: { role: 'MERCHANT' } } } },
      include: { user: { include: { identities: true, roles: true } } },
      orderBy: { id: 'asc' },
    });
    return accounts.map((account) => merchantSummary(account.user));
  }

  async update(userId: string, input: UpdateMerchantInput): Promise<MerchantSummary> {
    if (input.enabled === undefined && input.storeIds === undefined) {
      throw new BadRequestException('At least one merchant field must be provided.');
    }
    const replacementStoreIds = input.storeIds === undefined
      ? undefined
      : this.stores.resolveStoreIds(normalizeStoreIds(input.storeIds));

    return this.runSerializable(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { identities: true, roles: true },
      });
      if (!user || !user.roles.some((role) => role.role === 'MERCHANT')) throw new NotFoundException('Merchant not found.');

      if (replacementStoreIds) await assertStoresExist(tx, replacementStoreIds);
      const currentStoreIds = merchantStoreIds(user.roles);
      const scopesChanged = replacementStoreIds !== undefined && !sameStringSet(currentStoreIds, replacementStoreIds);
      const disabling = input.enabled === false && user.status !== 'DISABLED';
      const sessionInvalidated = scopesChanged || disabling;

      if (scopesChanged) {
        await tx.userRoleAssignment.deleteMany({ where: { userId, role: 'MERCHANT' } });
        await tx.userRoleAssignment.createMany({
          data: replacementStoreIds!.map((scopeId) => ({ userId, role: 'MERCHANT', scopeType: 'STORE', scopeId })),
        });
      }

      const data: Prisma.UserUpdateInput = {
        ...(input.enabled === undefined ? {} : { status: input.enabled ? 'ACTIVE' : 'DISABLED' }),
        ...(sessionInvalidated ? { sessionVersion: { increment: 1 } } : {}),
      };
      const updated = await tx.user.update({
        where: { id: userId }, data, include: { identities: true, roles: true },
      });
      if (sessionInvalidated) {
        await tx.authSession.updateMany({
          where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() },
        });
      }
      await this.audit.record({
        event: 'MERCHANT_UPDATED', userId,
        metadata: { scopesChanged, enabled: updated.status === 'ACTIVE', sessionInvalidated },
      }, tx);
      return merchantSummary(updated);
    });
  }

  private async runSerializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MERCHANT_TRANSACTION_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!isPrismaWriteConflict(error) || attempt === MERCHANT_TRANSACTION_MAX_ATTEMPTS) throw error;
      }
    }

    throw new Error('Merchant transaction retry limit reached.');
  }
}

function normalizeAccountName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(normalized)) {
    throw new BadRequestException('Account name must use 3-64 lowercase letters, digits, dots, underscores, or hyphens.');
  }
  return normalized;
}

function normalizeStoreIds(storeIds: string[]): string[] {
  const normalized = [...new Set(storeIds.map((id) => id.trim()).filter(Boolean))];
  if (normalized.length === 0) throw new BadRequestException('At least one store is required.');
  return normalized;
}

async function assertStoresExist(tx: Prisma.TransactionClient, storeIds: string[]): Promise<void> {
  const stores = await tx.store.findMany({ where: { id: { in: storeIds } }, select: { id: true } });
  if (stores.length !== storeIds.length) throw new BadRequestException('Store not found.');
}

function merchantSummary(user: MerchantUser): MerchantSummary {
  const accountIdentity = user.identities.find((identity) => identity.provider === 'ACCOUNT');
  const phoneIdentity = user.identities.find((identity) => identity.provider === 'PHONE');
  return {
    userId: user.id,
    username: accountIdentity?.accountName ?? '',
    phone: phoneIdentity?.phoneE164 ?? '',
    status: user.status,
    storeIds: merchantStoreIds(user.roles),
  };
}

function merchantStoreIds(roles: MerchantUser['roles']): string[] {
  return roles.filter((role) => role.role === 'MERCHANT' && role.scopeType === 'STORE' && role.scopeId.length > 0)
    .map((role) => role.scopeId).sort();
}

function sameStringSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === [...right].sort()[index]);
}

function isPrismaUniqueError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}

function isPrismaWriteConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2034';
}
