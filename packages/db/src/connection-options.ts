import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { PoolConfig } from 'mariadb';

export interface MariaDbConnectionConfigOptions {
  certificateDirectory?: string;
  requireTls?: boolean;
}

type StrictTlsOptions = Exclude<PoolConfig['ssl'], boolean | undefined> & {
  servername: string;
};

/**
 * Convert the Prisma-style mysql:// URL into explicit MariaDB driver options.
 *
 * The MariaDB driver does not understand Prisma's sslaccept/sslcert URL
 * parameters. Keeping this conversion in one place ensures the API, bootstrap
 * scripts, and migration probes all use the same fail-closed TLS policy.
 */
export function createMariaDbConnectionConfig(
  databaseUrl: string,
  options: MariaDbConnectionConfigOptions = {},
): PoolConfig {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Database URL must be a valid mysql:// URL.');
  }

  const database = decodeUrlComponent(parsed.pathname.replace(/^\//, ''), 'database name');
  const user = decodeUrlComponent(parsed.username, 'database username');
  const password = decodeUrlComponent(parsed.password, 'database password');
  const port = parsed.port ? Number(parsed.port) : 3306;

  if (parsed.protocol !== 'mysql:' || !parsed.hostname || !database || !user) {
    throw new Error('Database URL must be a mysql:// URL with a host, username, and database name.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Database URL contains an invalid port.');
  }

  const config: PoolConfig = {
    host: parsed.hostname,
    port,
    user,
    password,
    database,
  };

  const publicKeyValues = parsed.searchParams.getAll('allowPublicKeyRetrieval');
  if (publicKeyValues.length > 1 ||
      (publicKeyValues.length === 1 && !['true', 'false'].includes(publicKeyValues[0]))) {
    throw new Error('allowPublicKeyRetrieval must be specified at most once as true or false.');
  }
  if (publicKeyValues[0] === 'true') {
    config.allowPublicKeyRetrieval = true;
  }

  const sslAcceptValues = parsed.searchParams.getAll('sslaccept');
  const sslCertificateValues = parsed.searchParams.getAll('sslcert');
  const tlsRequested = sslAcceptValues.length > 0 || sslCertificateValues.length > 0;

  if (!tlsRequested) {
    if (options.requireTls) {
      throw new Error('This database connection requires sslaccept=strict and an sslcert CA certificate.');
    }
    return config;
  }
  if (sslAcceptValues.length !== 1 || sslAcceptValues[0] !== 'strict' ||
      sslCertificateValues.length !== 1 || !sslCertificateValues[0]) {
    throw new Error('TLS database URLs require exactly one sslaccept=strict and one sslcert parameter.');
  }
  if (config.allowPublicKeyRetrieval) {
    throw new Error('TLS database URLs must not enable allowPublicKeyRetrieval.');
  }

  const certificateDirectory = resolve(options.certificateDirectory ?? resolve(__dirname, '../prisma'));
  const certificateName = sslCertificateValues[0];
  const certificatePath = resolve(certificateDirectory, certificateName);
  const certificateRelativePath = relative(certificateDirectory, certificatePath);
  if (isAbsolute(certificateName) || !certificateRelativePath ||
      certificateRelativePath.startsWith('..') || isAbsolute(certificateRelativePath)) {
    throw new Error('sslcert must name a certificate inside the database schema directory.');
  }

  let ca: string;
  try {
    ca = readFileSync(certificatePath, 'utf8');
  } catch {
    throw new Error(`Database TLS CA certificate is not readable: ${certificatePath}`);
  }
  if (!ca.trim() || !ca.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error(`Database TLS CA certificate is not a non-empty PEM certificate: ${certificatePath}`);
  }

  const ssl: StrictTlsOptions = {
    ca,
    rejectUnauthorized: true,
    servername: parsed.hostname,
  };
  config.ssl = ssl;
  return config;
}

function decodeUrlComponent(value: string, label: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`Database URL contains an invalid encoded ${label}.`);
  }
}
