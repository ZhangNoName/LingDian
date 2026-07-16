import { ConfigService } from '@nestjs/config';

export function refreshCookieOptions(config: ConfigService) {
  return {
    httpOnly: true,
    secure: config.getOrThrow<boolean>('auth.cookieSecure'),
    sameSite: 'lax' as const,
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

export function corsOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    origin: corsOriginValidator(configuredCorsOrigins(env)),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  };
}

function configuredCorsOrigins(env: NodeJS.ProcessEnv): Set<string> {
  const configured = env.CORS_ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set(configured?.length ? configured : ['http://localhost:5173', 'http://localhost:5174']);
}

function corsOriginValidator(allowedOrigins: Set<string>) {
  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  };
}
