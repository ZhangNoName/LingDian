import { validateIntegrationEnv } from '../modules/integrations/integration.config';

type EnvRecord = Record<string, string | undefined>;

export function validateEnv(config: EnvRecord) {
  const errors: string[] = [];

  const isTestEnvironment = config.NODE_ENV === 'test';

  if (!isTestEnvironment) {
    validateSecret(config, 'AUTH_JWT_ACCESS_SECRET', errors);
    validateSecret(config, 'AUTH_REFRESH_PEPPER', errors);
  }

  if (config.PORT && Number.isNaN(Number(config.PORT))) {
    errors.push('PORT must be a valid number');
  }

  if (config.DATABASE_URL && !config.DATABASE_URL.startsWith('mysql://')) {
    errors.push('DATABASE_URL must use the mysql:// scheme');
  }

  validatePositiveInteger(config, 'AUTH_ACCESS_TOKEN_TTL_SECONDS', errors);
  validatePositiveInteger(config, 'AUTH_REFRESH_TOKEN_TTL_DAYS', errors);
  validateBootstrapAccountGroups(config, errors);
  validateIntegrationEnv(config, errors);

  if (config.NODE_ENV === 'production') {
    validateExpectedValue(
      config,
      'AUTH_ACCESS_TOKEN_TTL_SECONDS',
      '900',
      errors,
    );
    validateExpectedValue(
      config,
      'AUTH_REFRESH_TOKEN_TTL_DAYS',
      '30',
      errors,
    );

    if (config.AUTH_COOKIE_SECURE !== 'true') {
      errors.push('AUTH_COOKIE_SECURE must be true in production');
    }

    if (config.SMS_PROVIDER !== 'webhook') {
      errors.push('SMS_PROVIDER must be webhook in production; console delivery is not permitted');
    }
    validateRequiredValue(config, 'SMS_WEBHOOK_URL', errors);
    validateRequiredValue(config, 'SMS_WEBHOOK_TOKEN', errors);
    validateHttpsUrl(config, 'SMS_WEBHOOK_URL', errors);

    validateRequiredValue(config, 'WECHAT_APP_ID', errors);
    validateRequiredValue(config, 'WECHAT_APP_SECRET', errors);
    validateRequiredValue(config, 'WECHAT_REDIRECT_URI', errors);
    validateRequiredValue(config, 'WECHAT_MINI_APP_ID', errors);
    validateRequiredValue(config, 'WECHAT_MINI_APP_SECRET', errors);
    validateRequiredValue(config, 'QQ_APP_ID', errors);
    validateRequiredValue(config, 'QQ_APP_KEY', errors);
    validateRequiredValue(config, 'QQ_REDIRECT_URI', errors);
    validateRequiredValue(config, 'QQ_MINI_APP_ID', errors);
    validateRequiredValue(config, 'QQ_MINI_APP_SECRET', errors);
    validateHttpsUrl(config, 'WECHAT_REDIRECT_URI', errors);
    validateHttpsUrl(config, 'QQ_REDIRECT_URI', errors);
  }

  if (
    config.AUTH_COOKIE_SECURE !== undefined &&
    config.AUTH_COOKIE_SECURE !== 'true' &&
    config.AUTH_COOKIE_SECURE !== 'false'
  ) {
    errors.push('AUTH_COOKIE_SECURE must be true or false');
  }

  if (config.SWAGGER_ENABLED !== undefined && !['true', 'false'].includes(config.SWAGGER_ENABLED)) {
    errors.push('SWAGGER_ENABLED must be true or false');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }

  return config;
}

const BOOTSTRAP_ADMIN_VARIABLES = [
  'AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME',
  'AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD',
  'AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE',
] as const;

const BOOTSTRAP_MERCHANT_VARIABLES = [
  'AUTH_BOOTSTRAP_MERCHANT_USERNAME',
  'AUTH_BOOTSTRAP_MERCHANT_PASSWORD',
  'AUTH_BOOTSTRAP_MERCHANT_PHONE',
  'AUTH_BOOTSTRAP_MERCHANT_STORE_IDS',
] as const;

function validateBootstrapAccountGroups(config: EnvRecord, errors: string[]): void {
  for (const variables of [BOOTSTRAP_ADMIN_VARIABLES, BOOTSTRAP_MERCHANT_VARIABLES]) {
    const configured = variables.filter((name) => config[name]?.trim());
    if (configured.length > 0 && configured.length !== variables.length) {
      const missing = variables.filter((name) => !config[name]?.trim());
      errors.push(`Bootstrap account configuration is incomplete; ${missing.join(', ')} must also be set`);
    }
  }
}

function validateHttpsUrl(
  config: EnvRecord,
  name: 'SMS_WEBHOOK_URL' | 'WECHAT_REDIRECT_URI' | 'QQ_REDIRECT_URI',
  errors: string[],
) {
  const value = config[name];
  try {
    if (!value || new URL(value).protocol !== 'https:') throw new Error('invalid');
  } catch {
    errors.push(`${name} must be an absolute HTTPS URL`);
  }
}

function validateSecret(
  config: EnvRecord,
  name: 'AUTH_JWT_ACCESS_SECRET' | 'AUTH_REFRESH_PEPPER',
  errors: string[],
) {
  const value = config[name];

  if (!value) {
    errors.push(`${name} is required outside test`);
  } else if (value.length < 32) {
    errors.push(`${name} must be at least 32 characters`);
  }
}

function validatePositiveInteger(
  config: EnvRecord,
  name: 'AUTH_ACCESS_TOKEN_TTL_SECONDS' | 'AUTH_REFRESH_TOKEN_TTL_DAYS',
  errors: string[],
) {
  const value = config[name];

  if (value !== undefined && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
    errors.push(`${name} must be a positive integer`);
  }
}

function validateExpectedValue(
  config: EnvRecord,
  name: 'AUTH_ACCESS_TOKEN_TTL_SECONDS' | 'AUTH_REFRESH_TOKEN_TTL_DAYS',
  expected: '900' | '30',
  errors: string[],
) {
  if (config[name] !== undefined && config[name] !== expected) {
    errors.push(`${name} must be exactly ${expected}`);
  }
}

function validateRequiredValue(
  config: EnvRecord,
  name:
    | 'SMS_WEBHOOK_URL'
    | 'SMS_WEBHOOK_TOKEN'
    | 'WECHAT_APP_ID'
    | 'WECHAT_APP_SECRET'
    | 'WECHAT_REDIRECT_URI'
    | 'WECHAT_MINI_APP_ID'
    | 'WECHAT_MINI_APP_SECRET'
    | 'QQ_APP_ID'
    | 'QQ_APP_KEY'
    | 'QQ_REDIRECT_URI'
    | 'QQ_MINI_APP_ID'
    | 'QQ_MINI_APP_SECRET',
  errors: string[],
) {
  if (!config[name]?.trim()) {
    errors.push(`${name} is required in production`);
  }
}
