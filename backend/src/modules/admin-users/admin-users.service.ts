import type { AuthRole, CreatePlatformUserRequest, PlatformUserDetail, PlatformUserPage, PlatformUserQuery, PlatformUserStatus, PlatformUserSummary, UpdatePlatformUserRequest } from '@lingdian/contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IdentityProvider, Prisma, UserRole, UserStatus } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { AdminUserPolicy } from './admin-user-policy';
import { PasswordService } from '../auth/password.service';
import { normalizeChinesePhone } from '../auth/phone';

const userInclude = {
  identities: { select: { provider: true, accountName: true, phoneE164: true } },
  roles: { select: { role: true, scopeType: true, scopeId: true, status: true } },
} satisfies Prisma.UserInclude;

type UserRecord = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService) {}

  async list(query: PlatformUserQuery): Promise<PlatformUserPage> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const where = this.where(query);
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, include: userInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items: users.map((user) => this.mapUser(user)), page, pageSize, total };
  }

  async get(userId: string): Promise<PlatformUserDetail> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user) throw new NotFoundException('User not found.');
    return this.mapUser(user);
  }

  async listStoreOptions(): Promise<Array<{ id: string; name: string }>> {
    return this.prisma.store.findMany({ where: { status: { not: 'CLOSED' } }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }

  async setStatus(operator: AuthenticatedUser, userId: string, status: PlatformUserStatus): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId }, include: { roles: true } });
      if (!target) throw new NotFoundException('User not found.');
      const roles = target.roles.filter((role) => role.status === 'ACTIVE').map((role) => role.role as AuthRole);
      AdminUserPolicy.assertCanManage(operator.roles, roles, undefined, operator.userId === userId);
      const disabling = status === 'DISABLED';
      await tx.user.update({ where: { id: userId }, data: { status, ...(disabling ? { sessionVersion: { increment: 1 } } : {}) } });
      if (disabling) await tx.authSession.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      await tx.authAuditLog.create({ data: { event: status === 'DISABLED' ? 'ADMIN_USER_DISABLED' : 'ADMIN_USER_ENABLED', userId, metadata: { operatorId: operator.userId } } });
    });
  }

  async create(operator: AuthenticatedUser, input: CreatePlatformUserRequest): Promise<void> {
    const username = normalizeAccountName(input.username);
    const phone = normalizeChinesePhone(input.phone);
    const roles = normalizeRoles(input.roles);
    const storeIds = normalizeStoreIds(input.storeIds);
    assertMerchantStores(roles, storeIds);
    AdminUserPolicy.assertCanManage(operator.roles, [], roles);
    const passwordHash = await this.passwords.hash(input.password);

    await this.prisma.$transaction(async (tx) => {
      await assertStoresExist(tx, roles, storeIds);
      const created = await tx.user.create({ data: {
        nickname: input.nickname?.trim() || null,
        identities: { create: [
          { provider: 'ACCOUNT', subject: username, accountName: username, passwordCredential: { create: { passwordHash } } },
          { provider: 'PHONE', subject: phone, phoneE164: phone, verifiedAt: new Date() },
        ] },
        roles: { create: roleAssignments(roles, storeIds) },
      } });
      await tx.authAuditLog.create({ data: { event: 'ADMIN_USER_CREATED', userId: created.id, metadata: { operatorId: operator.userId, roles, storeCount: storeIds.length } } });
    });
  }

  async update(operator: AuthenticatedUser, userId: string, input: UpdatePlatformUserRequest): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId }, include: { roles: true, identities: true } });
      if (!target) throw new NotFoundException('User not found.');
      const currentRoles = target.roles.filter((role) => role.status === 'ACTIVE').map((role) => role.role as AuthRole);
      const requestedRoles = input.roles ? normalizeRoles(input.roles) : currentRoles;
      const storeIds = input.storeIds ? normalizeStoreIds(input.storeIds) : target.roles.filter((role) => role.role === 'MERCHANT' && role.scopeType === 'STORE' && role.status === 'ACTIVE').map((role) => role.scopeId);
      assertMerchantStores(requestedRoles, storeIds);
      AdminUserPolicy.assertCanManage(operator.roles, currentRoles, input.roles ? requestedRoles : undefined, operator.userId === userId);
      await assertStoresExist(tx, requestedRoles, storeIds);

      await tx.user.update({ where: { id: userId }, data: { nickname: input.nickname === undefined ? undefined : input.nickname.trim() || null, ...(input.roles || input.storeIds ? { sessionVersion: { increment: 1 } } : {}) } });
      const account = target.identities.find((identity) => identity.provider === 'ACCOUNT');
      const phone = target.identities.find((identity) => identity.provider === 'PHONE');
      if (input.username !== undefined && account) { const username = normalizeAccountName(input.username); await tx.authIdentity.update({ where: { id: account.id }, data: { subject: username, accountName: username } }); }
      if (input.phone !== undefined && phone) { const phoneE164 = normalizeChinesePhone(input.phone); await tx.authIdentity.update({ where: { id: phone.id }, data: { subject: phoneE164, phoneE164 } }); }
      if (input.roles || input.storeIds) {
        await tx.userRoleAssignment.deleteMany({ where: { userId } });
        await tx.userRoleAssignment.createMany({ data: roleAssignments(requestedRoles, storeIds).map((assignment) => ({ userId, ...assignment })) });
        await tx.authSession.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      }
      await tx.authAuditLog.create({ data: { event: 'ADMIN_USER_UPDATED', userId, metadata: { operatorId: operator.userId, rolesChanged: Boolean(input.roles), scopeChanged: Boolean(input.storeIds) } } });
    });
  }

  async resetPassword(operator: AuthenticatedUser, userId: string, password: string): Promise<void> {
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId }, include: { roles: true, identities: true } });
      if (!target) throw new NotFoundException('User not found.');
      const roles = target.roles.filter((role) => role.status === 'ACTIVE').map((role) => role.role as AuthRole);
      AdminUserPolicy.assertCanManage(operator.roles, roles, undefined, operator.userId === userId);
      const account = target.identities.find((identity) => identity.provider === 'ACCOUNT');
      if (!account) throw new BadRequestException('Account identity is required.');
      await tx.passwordCredential.update({ where: { identityId: account.id }, data: { passwordHash, passwordChangedAt: new Date() } });
      await tx.user.update({ where: { id: userId }, data: { mustChangePassword: true, sessionVersion: { increment: 1 } } });
      await tx.authSession.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      await tx.authAuditLog.create({ data: { event: 'ADMIN_USER_PASSWORD_RESET', userId, metadata: { operatorId: operator.userId } } });
    });
  }

  private where(query: PlatformUserQuery): Prisma.UserWhereInput {
    const keyword = query.keyword?.trim();
    return {
      ...(query.status ? { status: query.status as UserStatus } : {}),
      ...(keyword ? { OR: [
        { nickname: { contains: keyword } },
        { identities: { some: { accountName: { contains: keyword } } } },
        { identities: { some: { phoneE164: { contains: keyword } } } },
      ] } : {}),
      ...(query.role ? { roles: { some: { role: query.role as UserRole, status: 'ACTIVE' } } } : {}),
      ...(query.storeId ? { roles: { some: { role: 'MERCHANT', scopeType: 'STORE', scopeId: query.storeId, status: 'ACTIVE' } } } : {}),
    };
  }

  private mapUser(user: UserRecord): PlatformUserSummary {
    const activeRoles = user.roles.filter((assignment) => assignment.status === 'ACTIVE');
    const account = user.identities.find((identity) => identity.provider === 'ACCOUNT' as IdentityProvider);
    const phone = user.identities.find((identity) => identity.phoneE164)?.phoneE164 ?? null;
    return {
      userId: user.id,
      nickname: user.nickname,
      username: account?.accountName ?? null,
      phone,
      roles: [...new Set(activeRoles.map((assignment) => assignment.role as AuthRole))],
      storeIds: [...new Set(activeRoles.filter((assignment) => assignment.role === 'MERCHANT' && assignment.scopeType === 'STORE').map((assignment) => assignment.scopeId))],
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

function normalizeAccountName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(normalized)) throw new BadRequestException('Account name format is invalid.');
  return normalized;
}

function normalizeRoles(roles: AuthRole[]): AuthRole[] {
  const normalized = [...new Set(roles)];
  if (normalized.length === 0) throw new BadRequestException('At least one role is required.');
  return normalized;
}

function normalizeStoreIds(storeIds: string[]): string[] {
  return [...new Set(storeIds.map((id) => id.trim()).filter(Boolean))];
}

function assertMerchantStores(roles: AuthRole[], storeIds: string[]): void {
  if (roles.includes('MERCHANT') && storeIds.length === 0) throw new BadRequestException('Merchant role requires at least one store.');
}

function roleAssignments(roles: AuthRole[], storeIds: string[]): Array<{ role: UserRole; scopeType: string; scopeId: string }> {
  return roles.flatMap((role) => role === 'MERCHANT'
    ? storeIds.map((scopeId) => ({ role: role as UserRole, scopeType: 'STORE', scopeId }))
    : [{ role: role as UserRole, scopeType: 'GLOBAL', scopeId: '' }]);
}

async function assertStoresExist(tx: Prisma.TransactionClient, roles: AuthRole[], storeIds: string[]): Promise<void> {
  if (!roles.includes('MERCHANT')) return;
  const stores = await tx.store.findMany({ where: { id: { in: storeIds } }, select: { id: true } });
  if (stores.length !== storeIds.length) throw new BadRequestException('Store not found.');
}
