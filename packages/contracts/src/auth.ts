export type AuthAudience = 'user-api' | 'admin-api' | 'merchant-api';

export type AuthRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'MERCHANT';

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  audience: AuthAudience;
  roles: AuthRole[];
  /** Present only for merchant sessions; derived from active MERCHANT/STORE assignments. */
  merchantStoreIds?: string[];
}

export type AuthTokens = {
  access_token: string;
  expires_in: number;
  user: AuthenticatedUser;
};

export interface PhoneLoginRequest {
  phone: string;
  code: string;
  audience: 'user-api' | 'admin-api';
}

export interface AccountLoginRequest {
  username: string;
  password: string;
  audience: 'admin-api' | 'merchant-api';
}

export interface PasswordResetRequest {
  username: string;
  code: string;
  password: string;
  audience: 'merchant-api';
}

export interface CreateMerchantRequest {
  username: string;
  phone: string;
  password: string;
  storeIds: string[];
}

export interface MerchantSummary {
  userId: string;
  username: string;
  phone: string;
  status: 'ACTIVE' | 'DISABLED';
  storeIds: string[];
}

export type PlatformUserStatus = 'ACTIVE' | 'DISABLED';

export interface PlatformUserSummary {
  userId: string;
  nickname: string | null;
  username: string | null;
  phone: string | null;
  roles: AuthRole[];
  storeIds: string[];
  status: PlatformUserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type PlatformUserDetail = PlatformUserSummary;

export interface PlatformUserPage {
  items: PlatformUserSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PlatformUserQuery {
  keyword?: string;
  role?: AuthRole;
  status?: PlatformUserStatus;
  storeId?: string;
  page: number;
  pageSize: number;
}

export interface CreatePlatformUserRequest {
  nickname?: string;
  username: string;
  phone: string;
  password: string;
  roles: AuthRole[];
  storeIds: string[];
}

export interface UpdatePlatformUserRequest {
  nickname?: string;
  username?: string;
  phone?: string;
  roles?: AuthRole[];
  storeIds?: string[];
}

export interface ResetPlatformUserPasswordRequest {
  password: string;
}

export interface UpdateNicknameRequest {
  nickname: string;
}

export interface BeginOAuthResponse {
  authorization_url: string;
}

export interface PendingOAuthResponse {
  pending_oauth_id: string;
  expires_in: number;
}
