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
