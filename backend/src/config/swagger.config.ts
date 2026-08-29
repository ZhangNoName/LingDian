export function isSwaggerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SWAGGER_ENABLED === 'true' || (env.SWAGGER_ENABLED === undefined && env.NODE_ENV !== 'production');
}
