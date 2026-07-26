import type { AuthRole } from '@lingdian/contracts';
import { ForbiddenException } from '@nestjs/common';

const ROLE_RANK: Record<AuthRole, number> = {
  USER: 0,
  MERCHANT: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

function highestRank(roles: AuthRole[]): number {
  return Math.max(-1, ...roles.map((role) => ROLE_RANK[role]));
}

export class AdminUserPolicy {
  static assertCanManage(
    operatorRoles: AuthRole[],
    targetRoles: AuthRole[],
    requestedRoles?: AuthRole[],
    isSelf = false,
  ): void {
    if (isSelf) throw new ForbiddenException('You cannot manage your own account.');

    const operatorRank = highestRank(operatorRoles);
    if (operatorRank <= highestRank(targetRoles)) {
      throw new ForbiddenException('The target account has equal or higher authority.');
    }
    if (requestedRoles && highestRank(requestedRoles) >= operatorRank) {
      throw new ForbiddenException('You cannot assign a role at or above your authority.');
    }
  }
}
