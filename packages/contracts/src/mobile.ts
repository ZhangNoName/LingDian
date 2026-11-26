import type { AccountLoginRequest, AuthTokens } from './auth';

export type MobileAuthTokens = AuthTokens & { refresh_token: string };

export type MobileAccountLoginRequest = Pick<AccountLoginRequest, 'username' | 'password'>;
export type MobileAccountRoleChoices = { audiences: AccountLoginRequest['audience'][] };
export type MobileAccountLoginResult = MobileAuthTokens | MobileAccountRoleChoices;

export type InboxKind = 'ORDER_UPDATE' | 'NEW_ORDER' | 'INVENTORY_ALERT' | 'SYSTEM_ALERT';

export type InboxMessage = {
  id: string;
  kind: InboxKind;
  targetId: string;
  subject: string;
  state: string;
  createdAt: string;
  read: boolean;
};

export type InboxPage = { items: InboxMessage[]; nextCursor: string | null };

export type InboxAnchor = Pick<InboxMessage, 'id' | 'createdAt'>;

export type InboxUnreadStatus = {
  count: number;
  newestUnread: InboxAnchor | null;
  totalEvents?: number;
  newestEvent?: InboxAnchor | null;
};
