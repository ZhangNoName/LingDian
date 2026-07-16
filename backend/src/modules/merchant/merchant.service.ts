import { Injectable } from '@nestjs/common';
import { StoreStatus } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { MerchantStoreScope } from './merchant-store-scope';

export type MerchantStoreSummary = { id: string; code: string; name: string; status: StoreStatus };

@Injectable()
export class MerchantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: MerchantStoreScope = new MerchantStoreScope(),
  ) {}

  async listStores(user: AuthenticatedUser): Promise<MerchantStoreSummary[]> {
    const authorizedStoreIds = this.scope.storeIds(user);
    const stores = await this.prisma.store.findMany({
      where: { id: { in: authorizedStoreIds } },
      select: { id: true, code: true, name: true, status: true },
      orderBy: { id: 'asc' },
    });
    const allowed = new Set(authorizedStoreIds);
    return stores.filter((store) => allowed.has(store.id));
  }

  assertStoreAccess(user: AuthenticatedUser, storeId: string): void {
    this.scope.assertIncludes(user, storeId);
  }
}
