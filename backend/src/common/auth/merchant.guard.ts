import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from './authenticated-user.type';

/** Use after AccessTokenGuard for store-scoped merchant operations. */
@Injectable()
export class MerchantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;

    if (!user) throw new UnauthorizedException('Authentication is required.');
    if (user.audience !== 'merchant-api') throw new ForbiddenException('Merchant audience required.');
    if (!user.roles.includes('MERCHANT')) throw new ForbiddenException('Merchant role required.');
    if (!user.merchantStoreIds?.length) throw new ForbiddenException('Merchant store scope required.');

    return true;
  }
}
