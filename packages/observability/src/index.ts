export type ClientLogSource = 'MINIAPP' | 'MERCHANT_WEB' | 'ADMIN_WEB';
export type ClientLogEvent = {
  source: ClientLogSource;
  level: 'WARN' | 'ERROR';
  event: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ClientLogReporter = { report: (error: unknown, event?: string, details?: Record<string, unknown>) => void };

export function createClientLogReporter(
  source: ClientLogSource,
  send: (event: ClientLogEvent) => Promise<void> | void,
): ClientLogReporter {
  let sending = false;

  return {
    report(error, event = 'CLIENT_ERROR', details = {}) {
      if (sending) return;
      sending = true;
      void Promise.resolve(send({
        source,
        level: 'ERROR',
        event,
        message: error instanceof Error ? error.message : String(error),
        details: {
          ...details,
          ...(typeof location === 'undefined' ? {} : { path: location.pathname }),
        },
      })).catch(() => undefined).finally(() => {
        sending = false;
      });
    },
  };
}

export function installBrowserErrorReporter(reporter: ClientLogReporter): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onError = (event: ErrorEvent) => reporter.report(event.error ?? event.message, 'WINDOW_ERROR');
  const onRejection = (event: PromiseRejectionEvent) => reporter.report(event.reason, 'UNHANDLED_REJECTION');
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
