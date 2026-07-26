type ApiEnvelope<T> = { code: number; msg: string; data: T }

const API_UNAVAILABLE_MESSAGE = '后端服务暂时不可用，请确认 API 已在 9000 端口启动'

export async function readApiEnvelope<T>(response: Response): Promise<T> {
  const body = await response.text()
  if (!body.trim()) throw new Error(API_UNAVAILABLE_MESSAGE)

  let envelope: ApiEnvelope<T>
  try {
    envelope = JSON.parse(body) as ApiEnvelope<T>
  } catch {
    throw new Error(API_UNAVAILABLE_MESSAGE)
  }

  if (!response.ok || envelope.code !== 0) throw new Error(envelope.msg || '请求失败')
  return envelope.data
}
