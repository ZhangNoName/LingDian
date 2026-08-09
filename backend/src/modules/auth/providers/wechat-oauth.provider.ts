import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider } from './oauth-provider';

@Injectable()
export class WechatOAuthProvider implements OAuthProvider {
  readonly provider = 'WECHAT' as const;
  readonly redirectUri: string;
  readonly appId: string;
  readonly miniProgramAppId: string;
  private readonly appSecret: string;
  private readonly miniAppId: string;
  private readonly miniAppSecret: string;
  private miniAccessToken?: { value: string; expiresAt: number };

  constructor(config: ConfigService) {
    this.appId = config.getOrThrow<string>('auth.oauth.wechat.appId');
    this.appSecret = config.getOrThrow<string>('auth.oauth.wechat.appSecret');
    this.redirectUri = config.getOrThrow<string>('auth.oauth.wechat.redirectUri');
    this.miniAppId = config.getOrThrow<string>('auth.oauth.wechatMini.appId');
    this.miniProgramAppId = this.miniAppId;
    this.miniAppSecret = config.getOrThrow<string>('auth.oauth.wechatMini.appSecret');
  }

  buildAuthorizationUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const url = new URL('https://open.weixin.qq.com/connect/oauth2/authorize');
    url.search = new URLSearchParams({
      appid: this.appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'snsapi_userinfo',
      state,
    }).toString();
    return `${url.toString()}#wechat_redirect`;
  }

  async exchange({ code }: { code: string; redirectUri: string }) {
    const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    url.search = new URLSearchParams({
      appid: this.appId,
      secret: this.appSecret,
      code,
      grant_type: 'authorization_code',
    }).toString();
    const response = await fetch(url);
    const payload = await response.json() as { openid?: string; unionid?: string; nickname?: string; errcode?: number; errmsg?: string };
    if (!response.ok || !payload.openid) throw new Error(payload.errmsg ?? 'WeChat OAuth exchange failed.');
    return { openId: payload.openid, unionId: payload.unionid, displayName: payload.nickname };
  }

  async exchangeMiniProgramCode({ code }: { code: string }) {
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.search = new URLSearchParams({
      appid: this.miniAppId,
      secret: this.miniAppSecret,
      js_code: code,
      grant_type: 'authorization_code',
    }).toString();
    const response = await fetch(url);
    const payload = await response.json() as { openid?: string; unionid?: string; errcode?: number; errmsg?: string };
    if (!response.ok || !payload.openid) throw new Error(payload.errmsg ?? 'WeChat mini-program code exchange failed.');
    return { openId: payload.openid, unionId: payload.unionid };
  }

  async exchangeMiniProgramPhoneCode({ code }: { code: string }): Promise<{ phoneNumber: string }> {
    const firstToken = await this.getMiniAccessToken(false);
    const first = await this.requestPhoneNumber(code, firstToken);
    if (first.phoneNumber) return { phoneNumber: first.phoneNumber };

    if (isInvalidAccessToken(first.errcode)) {
      const refreshedToken = await this.getMiniAccessToken(true);
      const retried = await this.requestPhoneNumber(code, refreshedToken);
      if (retried.phoneNumber) return { phoneNumber: retried.phoneNumber };
    }

    throw new Error('WeChat phone number exchange failed.');
  }

  private async getMiniAccessToken(forceRefresh: boolean): Promise<string> {
    const refreshMarginMs = 5 * 60 * 1000;
    if (!forceRefresh && this.miniAccessToken && Date.now() < this.miniAccessToken.expiresAt - refreshMarginMs) {
      return this.miniAccessToken.value;
    }

    const response = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credential',
        appid: this.miniAppId,
        secret: this.miniAppSecret,
        force_refresh: forceRefresh,
      }),
    });
    const payload = await response.json() as {
      access_token?: string;
      expires_in?: number;
      errcode?: number;
    };
    if (!response.ok || !payload.access_token || !payload.expires_in) {
      throw new Error('WeChat access token exchange failed.');
    }

    this.miniAccessToken = {
      value: payload.access_token,
      expiresAt: Date.now() + payload.expires_in * 1000,
    };
    return payload.access_token;
  }

  private async requestPhoneNumber(code: string, accessToken: string): Promise<{ phoneNumber?: string; errcode?: number }> {
    const url = new URL('https://api.weixin.qq.com/wxa/business/getuserphonenumber');
    url.searchParams.set('access_token', accessToken);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const payload = await response.json() as {
      phone_info?: { phoneNumber?: string; purePhoneNumber?: string };
      errcode?: number;
    };
    if (!response.ok) return { errcode: payload.errcode };
    return {
      phoneNumber: payload.phone_info?.phoneNumber ?? payload.phone_info?.purePhoneNumber,
      errcode: payload.errcode,
    };
  }
}

function isInvalidAccessToken(errcode: number | undefined): boolean {
  return errcode === 40001 || errcode === 40014 || errcode === 42001;
}
