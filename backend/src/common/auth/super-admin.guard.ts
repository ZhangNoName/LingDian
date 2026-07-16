import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from './authenticated-user.type';

/** Use after AccessTokenGuard for super-administrator-only operations. */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;

    if (!user) throw new UnauthorizedException('Authentication is required.');
    if (user.audience !== 'admin-api') throw new ForbiddenException('Admin audience required.');
    if (!user.roles.includes('SUPER_ADMIN')) throw new ForbiddenException('Super administrator role required.');

    return true;
  }
}
