import { RES_CODE } from './codes'
import type { ResCodeMeta, ResCodeValue } from './types'

export const RES_CODE_META: Record<ResCodeValue, ResCodeMeta> = {
  [RES_CODE.SUCCESS]: {
    key: 'SUCCESS',
    message: 'success',
    comment: 'Common success response.',
  },
  [RES_CODE.PARAM_INVALID]: {
    key: 'PARAM_INVALID',
    message: 'Request parameters are invalid',
    comment: 'The request payload or query string failed validation.',
  },
  [RES_CODE.PARAM_MISSING]: {
    key: 'PARAM_MISSING',
    message: 'Required parameter is missing',
    comment: 'A required request parameter was not provided.',
  },
  [RES_CODE.UNAUTHORIZED]: {
    key: 'UNAUTHORIZED',
    message: 'Unauthorized',
    comment: 'Authentication is required or the session is invalid.',
  },
  [RES_CODE.FORBIDDEN]: {
    key: 'FORBIDDEN',
    message: 'Forbidden',
    comment: 'The current user does not have permission to access the resource.',
  },
  [RES_CODE.BUSINESS_ERROR]: {
    key: 'BUSINESS_ERROR',
    message: 'Business error',
    comment: 'Generic business exception for domain rule failures.',
  },
  [RES_CODE.RESOURCE_NOT_FOUND]: {
    key: 'RESOURCE_NOT_FOUND',
    message: 'Resource not found',
    comment: 'The requested resource does not exist.',
  },
  [RES_CODE.STATUS_CONFLICT]: {
    key: 'STATUS_CONFLICT',
    message: 'Status conflict',
    comment: 'The requested state transition is not allowed.',
  },
  [RES_CODE.DATABASE_ERROR]: {
    key: 'DATABASE_ERROR',
    message: 'Database error',
    comment: 'Generic persistence-layer failure.',
  },
  [RES_CODE.DATABASE_CONSTRAINT_ERROR]: {
    key: 'DATABASE_CONSTRAINT_ERROR',
    message: 'Database constraint error',
    comment: 'Unique, foreign-key, or similar database constraint was violated.',
  },
  [RES_CODE.DATABASE_RECORD_NOT_FOUND]: {
    key: 'DATABASE_RECORD_NOT_FOUND',
    message: 'Database record not found',
    comment: 'The expected record does not exist in persistence.',
  },
  [RES_CODE.INTERNAL_ERROR]: {
    key: 'INTERNAL_ERROR',
    message: 'Internal server error',
    comment: 'Unhandled server-side exception.',
  },
}
