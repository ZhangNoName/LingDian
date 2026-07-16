import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from './authenticated-user.type';

/**
 * Use after AccessTokenGuard. It narrows an authenticated request to an active
 * administrator session issued for the separate admin API audience.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;

    if (!user) throw new UnauthorizedException('Authentication is required.');
    if (user.audience !== 'admin-api') throw new ForbiddenException('Admin audience required.');
    if (!user.roles.includes('ADMIN') && !user.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Administrator role required.');
    }

    return true;
  }
}
