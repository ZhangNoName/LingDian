/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('admin sidebar styles', () => {
  it('keeps submenu titles and nested menu panels on the dark sidebar theme', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8')
    expect(css).toMatch(/\.sidebar-menu \{[^}]*background: var\(--sidebar\)/)
    expect(css).toMatch(/\.sidebar-menu__children \{[^}]*margin: 4px 0 0 16px/)
    expect(css).toContain('.sidebar-menu__item[aria-current="page"]')
  })
})
