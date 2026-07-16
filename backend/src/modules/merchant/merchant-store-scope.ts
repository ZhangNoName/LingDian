import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.type';

/** Reads the signed merchant session scope only; it never trusts a request store identifier. */
@Injectable()
export class MerchantStoreScope {
  storeIds(user: AuthenticatedUser): string[] {
    if (user.audience !== 'merchant-api' || !user.roles.includes('MERCHANT')) {
      throw new ForbiddenException('Merchant access is required.');
    }
    const storeIds = [...new Set((user.merchantStoreIds ?? []).map((storeId) => storeId.trim()).filter(Boolean))].sort();
    if (storeIds.length === 0) throw new ForbiddenException('Merchant store scope required.');
    return storeIds;
  }

  assertIncludes(user: AuthenticatedUser, storeId: string): void {
    if (!this.storeIds(user).includes(storeId.trim())) {
      throw new ForbiddenException('Merchant is not authorized for this store.');
    }
  }
}
