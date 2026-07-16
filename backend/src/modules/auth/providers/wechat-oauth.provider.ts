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
}
