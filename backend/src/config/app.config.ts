export const appConfig = () => ({
  app: {
    name: 'LingDian API',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    env: process.env.NODE_ENV ?? 'development',
  },
});
