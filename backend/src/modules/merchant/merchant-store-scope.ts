import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { StoreContextResolver } from '../stores/store-context.resolver';

/** Reads the signed merchant session scope only; it never trusts a request store identifier. */
@Injectable()
export class MerchantStoreScope {
  constructor(private readonly stores: StoreContextResolver) {}

  storeIds(user: AuthenticatedUser): string[] {
    if (user.audience !== 'merchant-api' || !user.roles.includes('MERCHANT')) {
      throw new ForbiddenException('Merchant access is required.');
    }
    const storeIds = [...new Set((user.merchantStoreIds ?? []).map((storeId) => storeId.trim()).filter(Boolean))].sort();
    if (storeIds.length === 0) throw new ForbiddenException('Merchant store scope required.');
    return this.stores.resolveStoreIds(storeIds);
  }

  /** A multi-store merchant must explicitly select one authorized store for a business request. */
  forRequest(user: AuthenticatedUser, requestedStoreId?: string): string[] {
    const authorized = this.storeIds(user);
    if (requestedStoreId !== undefined) {
      if (!authorized.includes(requestedStoreId)) throw new ForbiddenException('Merchant is not authorized for this store.');
      return [requestedStoreId];
    }
    if (authorized.length !== 1) throw new BadRequestException('Select a store before continuing.');
    return authorized;
  }

  assertIncludes(user: AuthenticatedUser, storeId: string): void {
    if (!this.storeIds(user).includes(storeId.trim())) {
      throw new ForbiddenException('Merchant is not authorized for this store.');
    }
  }
}
