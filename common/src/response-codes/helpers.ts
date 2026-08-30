import { RES_CODE_META } from './meta.js'
import type { ResCodeMeta, ResponseEnvelope } from './types.js'

export function getResCodeMeta(code: number): ResCodeMeta {
  return (
    RES_CODE_META[code as keyof typeof RES_CODE_META] ?? {
      key: 'UNKNOWN',
      message: 'Unknown response code',
      comment: 'Fallback metadata for an undefined business response code.',
    }
  )
}

export function getResCodeMessage(code: number) {
  return getResCodeMeta(code).message
}

export function isResponseEnvelope<T>(value: unknown): value is ResponseEnvelope<T> {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { code?: unknown; msg?: unknown }
  return (
    typeof candidate.code === 'number' &&
    Object.prototype.hasOwnProperty.call(RES_CODE_META, candidate.code) &&
    typeof candidate.msg === 'string' &&
    'data' in value
  )
}
