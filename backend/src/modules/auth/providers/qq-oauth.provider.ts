import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider } from './oauth-provider';

@Injectable()
export class QqOAuthProvider implements OAuthProvider {
  readonly provider = 'QQ' as const;
  readonly redirectUri: string;
  readonly appId: string;
  readonly miniProgramAppId: string;
  private readonly appKey: string;
  private readonly miniAppId: string;
  private readonly miniAppSecret: string;

  constructor(config: ConfigService) {
    this.appId = config.getOrThrow<string>('auth.oauth.qq.appId');
    this.appKey = config.getOrThrow<string>('auth.oauth.qq.appKey');
    this.redirectUri = config.getOrThrow<string>('auth.oauth.qq.redirectUri');
    this.miniAppId = config.getOrThrow<string>('auth.oauth.qqMini.appId');
    this.miniProgramAppId = this.miniAppId;
    this.miniAppSecret = config.getOrThrow<string>('auth.oauth.qqMini.appSecret');
  }

  buildAuthorizationUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const url = new URL('https://graph.qq.com/oauth2.0/authorize');
    url.search = new URLSearchParams({
      response_type: 'code', client_id: this.appId, redirect_uri: redirectUri, state,
    }).toString();
    return url.toString();
  }

  async exchange({ code, redirectUri }: { code: string; redirectUri: string }) {
    const tokenUrl = new URL('https://graph.qq.com/oauth2.0/token');
    tokenUrl.search = new URLSearchParams({
      grant_type: 'authorization_code', client_id: this.appId, client_secret: this.appKey, code, redirect_uri: redirectUri,
    }).toString();
    const tokenResponse = await fetch(tokenUrl);
    const token = new URLSearchParams(await tokenResponse.text()).get('access_token');
    if (!tokenResponse.ok || !token) throw new Error('QQ OAuth token exchange failed.');

    const meUrl = new URL('https://graph.qq.com/oauth2.0/me');
    meUrl.searchParams.set('access_token', token);
    const meResponse = await fetch(meUrl);
    const text = await meResponse.text();
    const match = text.match(/\{[\s\S]*\}/);
    const payload = match ? JSON.parse(match[0]) as { openid?: string } : {};
    if (!meResponse.ok || !payload.openid) throw new Error('QQ OAuth identity lookup failed.');
    return { openId: payload.openid };
  }

  async exchangeMiniProgramCode({ code }: { code: string }) {
    const url = new URL('https://api.q.qq.com/sns/jscode2session');
    url.search = new URLSearchParams({
      appid: this.miniAppId,
      secret: this.miniAppSecret,
      js_code: code,
      grant_type: 'authorization_code',
    }).toString();
    const response = await fetch(url);
    const payload = await response.json() as { openid?: string; unionid?: string; errcode?: number; errmsg?: string };
    if (!response.ok || !payload.openid) throw new Error(payload.errmsg ?? 'QQ mini-program code exchange failed.');
    return { openId: payload.openid, unionId: payload.unionid };
  }
}
