export const ResponseCode = {
  SUCCESS: 0,

  PARAM_INVALID: 1001,
  PARAM_MISSING: 1002,
  UNAUTHORIZED: 1003,
  FORBIDDEN: 1004,

  BUSINESS_ERROR: 2001,
  RESOURCE_NOT_FOUND: 2002,
  STATUS_CONFLICT: 2003,

  DATABASE_ERROR: 3001,
  DATABASE_CONSTRAINT_ERROR: 3002,
  DATABASE_RECORD_NOT_FOUND: 3003,

  INTERNAL_ERROR: 5000,
} as const;

export type ResponseCodeValue =
  (typeof ResponseCode)[keyof typeof ResponseCode];

export interface ResponseEnvelope<T> {
  code: ResponseCodeValue;
  msg: string;
  data: T;
}
