import type { AuthAudience as ContractAuthAudience, AuthRole as ContractAuthRole } from '@lingdian/contracts';

export type AuthAudience = ContractAuthAudience;

export type AuthRole = ContractAuthRole;

export type AuthenticatedUser = {
  userId: string;
  sessionId: string;
  audience: AuthAudience;
  roles: AuthRole[];
  mustChangePassword?: boolean;
  merchantStoreIds?: string[];
};
