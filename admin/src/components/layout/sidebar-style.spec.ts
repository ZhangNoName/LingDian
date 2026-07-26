/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('admin sidebar styles', () => {
  it('keeps submenu titles and nested menu panels on the dark sidebar theme', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8')
    expect(css).toContain('.sidebar-menu.el-menu{--el-menu-bg-color:transparent')
    expect(css).toContain('.sidebar-menu .el-sub-menu__title')
    expect(css).toContain('.sidebar-menu .el-menu{background:transparent}')
  })
})
