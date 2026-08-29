import type { IntegrationProvider } from '@lingdian/contracts';

export type ConnectorSettings = {
  provider: IntegrationProvider;
  displayName: string;
  category: 'CASHIER' | 'PRINTING' | 'DELIVERY';
  deploymentEnabled: boolean;
  endpoint?: string;
  signingSecret?: string;
};

type EnvRecord = Record<string, string | undefined>;

const PROVIDER_CONFIG = [
  { provider: 'CASHIER', prefix: 'CASHIER', displayName: '收银系统', category: 'CASHIER' },
  { provider: 'RECEIPT_PRINTER', prefix: 'RECEIPT', displayName: '小票打印网关', category: 'PRINTING' },
  { provider: 'MEITUAN_WAIMAI', prefix: 'MEITUAN', displayName: '美团外卖连接器', category: 'DELIVERY' },
  { provider: 'JD_DAOJIA', prefix: 'JD', displayName: '京东到家连接器', category: 'DELIVERY' },
] as const satisfies ReadonlyArray<{
  provider: IntegrationProvider;
  prefix: string;
  displayName: string;
  category: ConnectorSettings['category'];
}>;

export function readConnectorSettings(env: EnvRecord = process.env): ConnectorSettings[] {
  return PROVIDER_CONFIG.map((definition) => ({
    provider: definition.provider,
    displayName: definition.displayName,
    category: definition.category,
    deploymentEnabled: env[`INTEGRATION_${definition.prefix}_ENABLED`] === 'true',
    endpoint: clean(env[`INTEGRATION_${definition.prefix}_CONNECTOR_URL`]),
    signingSecret: clean(env[`INTEGRATION_${definition.prefix}_SIGNING_SECRET`]),
  }));
}

export function validateIntegrationEnv(env: EnvRecord, errors: string[]): void {
  for (const definition of PROVIDER_CONFIG) {
    const enabledName = `INTEGRATION_${definition.prefix}_ENABLED`;
    const endpointName = `INTEGRATION_${definition.prefix}_CONNECTOR_URL`;
    const secretName = `INTEGRATION_${definition.prefix}_SIGNING_SECRET`;
    const enabled = env[enabledName];

    if (enabled !== undefined && enabled !== 'true' && enabled !== 'false') {
      errors.push(`${enabledName} must be true or false`);
    }
    if (enabled !== 'true') continue;

    const endpoint = clean(env[endpointName]);
    const secret = clean(env[secretName]);
    if (!endpoint) errors.push(`${endpointName} is required when ${enabledName}=true`);
    if (!secret || secret.length < 32) errors.push(`${secretName} must contain at least 32 characters`);

    try {
      const url = new URL(endpoint ?? '');
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
      if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        errors.push(`${endpointName} must use HTTPS in production`);
      }
    } catch {
      if (endpoint) errors.push(`${endpointName} must be an absolute HTTP(S) URL`);
    }
  }
}

function clean(value?: string): string | undefined {
  return value?.trim() || undefined;
}
