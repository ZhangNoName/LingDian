import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './authenticated-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user,
);
