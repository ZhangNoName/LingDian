export type DictionaryValue = string | number | boolean

export type DictionaryOption = {
  value: DictionaryValue
  labelKey: string
  fallbackLabel: string
  disabled?: boolean
  meta?: Readonly<Record<string, unknown>>
}

export type DictionaryLoader = () => Promise<readonly DictionaryOption[]> | readonly DictionaryOption[]
export type DictionarySource = readonly DictionaryOption[] | DictionaryLoader
export type DictionaryTranslator = (key: string, fallbackLabel: string) => string
