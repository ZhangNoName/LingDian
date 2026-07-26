import ElementPlus from 'element-plus'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import SchemaSearchForm from './SchemaSearchForm.vue'
import SchemaTableActions from './SchemaTableActions.vue'
import SchemaTablePage from './SchemaTablePage.vue'
import type { SchemaAction, SchemaColumn } from './types'

type Row = { id: string; name: string; status: string }
const TestIcon = defineComponent({ name: 'TestIcon', setup: () => () => h('span', 'icon') })

const columns: SchemaColumn<Row>[] = [
  { dataIndex: 'name', queryKey: 'keyword', label: '关键词', isSearch: true, placeholder: '搜索名称' },
  { dataIndex: 'status', label: '状态', isSearch: true, searchType: 'select', options: [{ value: 'ACTIVE', labelKey: 'active', fallbackLabel: '正常' }] },
  { dataIndex: 'id', label: '编号' },
  { key: 'actions', label: '操作', slot: 'actions', fixed: 'right', width: 90 },
]

describe('schema table components', () => {
  it('emits search/reset and exposes collapsible search state', async () => {
    const wrapper = mount(SchemaSearchForm<Row>, {
      props: { columns, query: { keyword: 'zero', status: 'ACTIVE' } },
      slots: { 'search-actions': () => h('button', { 'data-testid': 'create-account' }, '新建用户') },
      global: { plugins: [ElementPlus] },
    })

    expect(wrapper.get('.schema-search__buttons').find('[data-testid="create-account"]').exists()).toBe(true)

    await wrapper.get('[data-testid="schema-search-submit"]').trigger('click')
    expect(wrapper.emitted('search')).toHaveLength(1)

    await wrapper.get('[data-testid="schema-search-reset"]').trigger('click')
    expect(wrapper.emitted('update:query')?.at(-1)?.[0]).toEqual({ keyword: undefined, status: undefined })
    expect(wrapper.emitted('reset')).toHaveLength(1)

    const collapse = wrapper.get('[data-testid="schema-search-collapse"]')
    expect(collapse.attributes('aria-expanded')).toBe('true')
    await collapse.trigger('click')
    expect(collapse.attributes('aria-expanded')).toBe('false')
  })

  it('renders accessible icon actions and honors disabled callbacks', async () => {
    const click = vi.fn()
    const actions: SchemaAction<Row>[] = [
      { key: 'edit', label: '编辑', icon: TestIcon, disabled: (row) => row.status !== 'ACTIVE', onClick: click },
    ]
    const wrapper = mount(SchemaTableActions<Row>, {
      props: { row: { id: '1', name: '小零', status: 'DISABLED' }, actions },
      global: { plugins: [ElementPlus] },
    })

    const button = wrapper.get('button[aria-label="编辑"]')
    expect(button.attributes()).toHaveProperty('disabled')
    await button.trigger('click')
    expect(click).not.toHaveBeenCalled()
  })

  it('keeps the table in a flex body, forwards cell slots, and emits pagination changes', async () => {
    const wrapper = mount(SchemaTablePage<Row>, {
      props: {
        columns,
        query: {},
        data: [{ id: '1', name: '小零', status: 'ACTIVE' }],
        pagination: { page: 1, pageSize: 20, total: 45 },
      },
      slots: { 'cell-name': ({ row }: { row: Row }) => h('strong', { 'data-testid': 'custom-name' }, row.name) },
      global: { plugins: [ElementPlus] },
    })

    expect(wrapper.get('.schema-table-page__table').attributes('data-scroll-owner')).toBe('table')
    expect(wrapper.find('[data-testid="custom-name"]').exists()).toBe(true)
    const actionColumn = wrapper.findAllComponents({ name: 'ElTableColumn' }).find((item) => item.props('label') === '操作')
    expect(actionColumn?.props('fixed')).toBe('right')

    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('update:current-page', 2)
    expect(wrapper.emitted('page-change')?.at(-1)?.[0]).toBe(2)
  })
})
