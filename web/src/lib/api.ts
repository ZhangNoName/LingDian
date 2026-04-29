import {
  RES_CODE,
  getResCodeMessage,
  isResponseEnvelope,
  type ResponseEnvelope,
} from '@lingdian/common'

async function parseErrorMessage(response: Response) {
  const fallbackMessage = getResCodeMessage(RES_CODE.BUSINESS_ERROR)

  try {
    const body = (await response.json()) as Partial<ResponseEnvelope<unknown>> & {
      message?: string | string[]
    }

    if (Array.isArray(body.message)) {
      return body.message.join('; ')
    }

    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message
    }

    if (typeof body.msg === 'string' && body.msg.trim()) {
      return body.msg
    }
  } catch {
    return fallbackMessage
  }

  return fallbackMessage
}

export async function requestData<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  const body = (await response.json()) as ResponseEnvelope<T> | T

  if (isResponseEnvelope<T>(body)) {
    if (body.code !== RES_CODE.SUCCESS) {
      throw new Error(body.msg || getResCodeMessage(body.code))
    }

    return body.data
  }

  return body as T
}
