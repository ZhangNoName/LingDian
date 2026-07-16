import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from './authenticated-user.type';

/** Use after AccessTokenGuard for customer-facing user-api operations. */
@Injectable()
export class UserApiGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;

    if (!user) throw new UnauthorizedException('Authentication is required.');
    if (user.audience !== 'user-api') throw new ForbiddenException('User audience required.');

    return true;
  }
}
