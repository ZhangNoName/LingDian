import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { MerchantStoreScope } from '../../merchant/merchant-store-scope';
import { PrismaService } from '../../../prisma/prisma.service';
import { PurchasingQueryDto, SupplierDto, UpdateSupplierDto } from './purchasing.dto';
@Injectable()
export class SupplierService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: MerchantStoreScope,
  ) {}
  async list(user: AuthenticatedUser, storeId: string, query: PurchasingQueryDto) {
    this.scope.assertIncludes(user, storeId);
    const where = {
      storeId,
      ...(query.status === 'ACTIVE' ? { isActive: true } : {}),
      ...(query.keyword ? { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] } : {}),
    };
    return this.db.$transaction(
      async (tx) => ({
        items: await tx.supplier.findMany({
          where,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        total: await tx.supplier.count({ where }),
        page: query.page,
        pageSize: query.pageSize,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async save(user: AuthenticatedUser, storeId: string, body: SupplierDto | UpdateSupplierDto, id?: string) {
    this.scope.assertIncludes(user, storeId);
    const data = {
      code: body.code.toUpperCase(),
      name: body.name,
      contact: body.contact,
      note: body.note,
      isActive: body.isActive,
    };
    try {
      return await this.db.$transaction(
        async (tx) => {
          if (id) {
            const existing = await tx.supplier.findUnique({ where: { id_storeId: { id, storeId } } });
            if (!existing) throw new NotFoundException('purchasing.notFound');
            const changed = await tx.supplier.updateMany({
              where: { id, storeId, version: (body as UpdateSupplierDto).expectedVersion },
              data: { ...data, version: { increment: 1 } },
            });
            if (changed.count !== 1) throw new ConflictException('purchasing.stale');
          }
          const saved = id
            ? await tx.supplier.findUniqueOrThrow({ where: { id_storeId: { id, storeId } } })
            : await tx.supplier.create({ data: { ...data, storeId } });
          await tx.authAuditLog.create({
            data: {
              event: 'SUPPLIER_SAVED',
              userId: user.userId,
              sessionId: user.sessionId,
              metadata: { storeId, supplierId: saved.id, version: saved.version, isActive: saved.isActive },
            },
          });
          return saved;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('purchasing.codeExists');
      throw error;
    }
  }
}
