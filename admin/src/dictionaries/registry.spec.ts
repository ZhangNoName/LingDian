import { describe, expect, it, vi } from 'vitest'
import { DictionaryRegistry } from './registry'

describe('DictionaryRegistry', () => {
  it('resolves fallback and translated labels while preserving unknown values', async () => {
    const registry = new DictionaryRegistry()
    registry.register('status', [
      { value: 'ACTIVE', labelKey: 'dict.status.active', fallbackLabel: '正常' },
    ])

    expect(await registry.getOptions('status')).toEqual([
      { value: 'ACTIVE', labelKey: 'dict.status.active', fallbackLabel: '正常' },
    ])
    expect(await registry.getLabel('status', 'ACTIVE')).toBe('正常')
    expect(await registry.getLabel('status', 'ACTIVE', (key) => `translated:${key}`)).toBe('translated:dict.status.active')
    expect(await registry.getLabel('status', 'UNKNOWN')).toBe('UNKNOWN')
  })

  it('caches async loaders until the dictionary is invalidated', async () => {
    const loader = vi.fn(async () => [
      { value: 1, labelKey: 'dict.rank.first', fallbackLabel: '第一' },
    ])
    const registry = new DictionaryRegistry()
    registry.register('rank', loader)

    await registry.getOptions('rank')
    await registry.getOptions('rank')
    expect(loader).toHaveBeenCalledTimes(1)

    registry.invalidate('rank')
    await registry.getOptions('rank')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('replacement registration drops a cached result', async () => {
    const registry = new DictionaryRegistry()
    registry.register('status', [{ value: 'OLD', labelKey: 'old', fallbackLabel: '旧' }])
    await registry.getOptions('status')

    registry.register('status', [{ value: 'NEW', labelKey: 'new', fallbackLabel: '新' }])

    expect(await registry.getOptions('status')).toEqual([
      { value: 'NEW', labelKey: 'new', fallbackLabel: '新' },
    ])
  })

  it('returns an empty option list for an unregistered dictionary', async () => {
    const registry = new DictionaryRegistry()
    expect(await registry.getOptions('missing')).toEqual([])
  })
})
