type EnvRecord = Record<string, string | undefined>;

export function validateEnv(config: EnvRecord) {
  const errors: string[] = [];

  if (config.PORT && Number.isNaN(Number(config.PORT))) {
    errors.push('PORT must be a valid number');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }

  return config;
}
