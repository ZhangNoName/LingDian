import type { RES_CODE } from './codes'

export type ResCodeKey = keyof typeof RES_CODE
export type ResCodeValue = (typeof RES_CODE)[ResCodeKey]

export interface ResCodeMeta {
  key: ResCodeKey | 'UNKNOWN'
  message: string
  comment: string
}

export interface ResponseEnvelope<T> {
  code: ResCodeValue
  msg: string
  data: T
}
