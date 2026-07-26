import type { AuthRole, PlatformUserDetail, PlatformUserPage, PlatformUserQuery, PlatformUserSummary } from '@lingdian/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { IdentityProvider, Prisma, UserRole, UserStatus } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';

const userInclude = {
  identities: { select: { provider: true, accountName: true, phoneE164: true } },
  roles: { select: { role: true, scopeType: true, scopeId: true, status: true } },
} satisfies Prisma.UserInclude;

type UserRecord = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

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
