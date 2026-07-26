import type {
  DictionaryOption,
  DictionarySource,
  DictionaryTranslator,
  DictionaryValue,
} from './types'

export class DictionaryRegistry {
  private readonly sources = new Map<string, DictionarySource>()
  private readonly cache = new Map<string, Promise<readonly DictionaryOption[]>>()

  register(code: string, source: DictionarySource): void {
    this.sources.set(code, source)
    this.invalidate(code)
  }

  has(code: string): boolean {
    return this.sources.has(code)
  }

  async getOptions(code: string): Promise<readonly DictionaryOption[]> {
    const existing = this.cache.get(code)
    if (existing) return existing

    const source = this.sources.get(code)
    if (!source) return []

    const pending = Promise.resolve(typeof source === 'function' ? source() : source)
      .then((options) => options.map((option) => ({ ...option })))
      .catch((error: unknown) => {
        this.cache.delete(code)
        throw error
      })
    this.cache.set(code, pending)
    return pending
  }

  async getLabel(
    code: string,
    value: DictionaryValue | null | undefined,
    translate?: DictionaryTranslator,
  ): Promise<string> {
    if (value === null || value === undefined || value === '') return ''
    const option = (await this.getOptions(code)).find((item) => item.value === value)
    if (!option) return String(value)
    return translate?.(option.labelKey, option.fallbackLabel) ?? option.fallbackLabel
  }

  invalidate(code?: string): void {
    if (code) this.cache.delete(code)
    else this.cache.clear()
  }
}

export const dictionaryRegistry = new DictionaryRegistry()
