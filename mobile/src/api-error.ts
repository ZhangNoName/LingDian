export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly details?: unknown, readonly code?: number) {
    super(message);
  }
}
