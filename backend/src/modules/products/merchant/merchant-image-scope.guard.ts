import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { PrismaService } from '../../../prisma/prisma.service';
import { MerchantStoreScope } from '../../merchant/merchant-store-scope';
@Injectable()
export class MerchantImageScopeGuard implements CanActivate {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: MerchantStoreScope,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser; params: { storeId: string; id: string } }>();
    if (!request.user) throw new UnauthorizedException();
    const { storeId, id } = request.params;
    this.scope.assertIncludes(request.user, storeId);
    if (!(await this.db.product.findFirst({ where: { id, storeId }, select: { id: true } })))
      throw new NotFoundException('catalog.productUnavailable');
    return true;
  }
}
