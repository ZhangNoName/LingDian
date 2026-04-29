import { RES_CODE_META } from './meta'
import type { ResCodeMeta, ResponseEnvelope } from './types'

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
  return Boolean(
    value &&
      typeof value === 'object' &&
      'code' in value &&
      'msg' in value &&
      'data' in value,
  )
}
