export const OAUTH_PROVIDERS = Symbol('OAUTH_PROVIDERS');

export interface OAuthProvider {
  readonly provider: 'WECHAT' | 'QQ';
  readonly appId: string;
  readonly miniProgramAppId: string;
  readonly redirectUri: string;
  buildAuthorizationUrl(input: { state: string; redirectUri: string }): string;
  exchange(input: { code: string; redirectUri: string }): Promise<{
    openId: string;
    unionId?: string;
    displayName?: string;
  }>;
  exchangeMiniProgramCode(input: { code: string }): Promise<{
    openId: string;
    unionId?: string;
    displayName?: string;
  }>;
  exchangeMiniProgramPhoneCode?(input: { code: string }): Promise<{
    phoneNumber: string;
  }>;
}
