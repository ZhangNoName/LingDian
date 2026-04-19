type EnvRecord = Record<string, string | undefined>;

export function validateEnv(config: EnvRecord) {
  const errors: string[] = [];

  if (config.PORT && Number.isNaN(Number(config.PORT))) {
    errors.push('PORT must be a valid number');
  }

  if (config.DATABASE_URL && !config.DATABASE_URL.startsWith('mysql://')) {
    errors.push('DATABASE_URL must use the mysql:// scheme');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }

  return config;
}
