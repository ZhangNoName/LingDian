export const appConfig = () => ({
  app: {
    name: 'LingDian API',
    port: Number(process.env.PORT ?? 9000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    env: process.env.NODE_ENV ?? 'development',
  },
  auth: {
    jwtAccessSecret: process.env.AUTH_JWT_ACCESS_SECRET ?? '',
    refreshPepper: process.env.AUTH_REFRESH_PEPPER ?? '',
    accessTokenTtlSeconds: Number(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? 900),
    refreshTokenTtlDays: Number(process.env.AUTH_REFRESH_TOKEN_TTL_DAYS ?? 30),
    cookieSecure:
      process.env.AUTH_COOKIE_SECURE === 'true' ||
      (process.env.AUTH_COOKIE_SECURE === undefined && process.env.NODE_ENV === 'production'),
    oauth: {
      wechat: {
        appId: process.env.WECHAT_APP_ID ?? '',
        appSecret: process.env.WECHAT_APP_SECRET ?? '',
        redirectUri: process.env.WECHAT_REDIRECT_URI ?? '',
      },
      wechatMini: {
        appId: process.env.WECHAT_MINI_APP_ID ?? '',
        appSecret: process.env.WECHAT_MINI_APP_SECRET ?? '',
      },
      qq: {
        appId: process.env.QQ_APP_ID ?? '',
        appKey: process.env.QQ_APP_KEY ?? '',
        redirectUri: process.env.QQ_REDIRECT_URI ?? '',
      },
      qqMini: {
        appId: process.env.QQ_MINI_APP_ID ?? '',
        appSecret: process.env.QQ_MINI_APP_SECRET ?? '',
      },
    },
    smsProvider: process.env.SMS_PROVIDER ?? 'console',
  },
});
