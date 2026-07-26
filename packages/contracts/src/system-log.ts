export const SYSTEM_LOG_SOURCES = ['SERVER', 'MINIAPP', 'MERCHANT_WEB', 'ADMIN_WEB'] as const;
export type SystemLogSource = (typeof SYSTEM_LOG_SOURCES)[number];

export const SYSTEM_LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'FATAL'] as const;
export type SystemLogLevel = (typeof SYSTEM_LOG_LEVELS)[number];

export const SYSTEM_LOG_CATEGORIES = ['LIFECYCLE', 'HTTP', 'CLIENT', 'SECURITY'] as const;
export type SystemLogCategory = (typeof SYSTEM_LOG_CATEGORIES)[number];

export type ClientLogEvent = {
  source: Exclude<SystemLogSource, 'SERVER'>;
  level: Extract<SystemLogLevel, 'WARN' | 'ERROR'>;
  event: string;
  message: string;
  details?: Record<string, unknown>;
};

export type SystemLogRecord = {
  id: string;
  source: SystemLogSource;
  level: SystemLogLevel;
  category: SystemLogCategory;
  event: string;
  message: string;
  requestId: string | null;
  userId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  ip: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type SystemLogPage = {
  items: SystemLogRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type SystemLogQuery = {
  source?: SystemLogSource;
  level?: SystemLogLevel;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};
