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
  it('emits search on form submit and exposes collapsible search state', async () => {
    const wrapper = mount(SchemaSearchForm<Row>, {
      props: { columns, query: { keyword: 'zero', status: 'ACTIVE' } },
    })

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('search')).toHaveLength(1)

    const collapse = wrapper.get('[data-testid="schema-search-collapse"]')
    expect(collapse.attributes('aria-expanded')).toBe('true')
    await collapse.trigger('click')
    expect(collapse.attributes('aria-expanded')).toBe('false')
  })

  it('validates typed date ranges against both ends and clears the validation after correction', async () => {
    const columns: SchemaColumn<Row>[] = [{ key: 'period', label: '统计期间', isSearch: true, searchType: 'dateRange' }]
    const wrapper = mount(SchemaSearchForm<Row>, {
      props: { columns, query: { period: ['2026-11-18', '2026-11-17'] } },
    })
    const [start, end] = wrapper.findAll<HTMLInputElement>('input[type="text"]')
    expect(start!.element.validationMessage).toContain('或之前')
    expect(end!.element.validationMessage).toContain('或之后')
    await wrapper.setProps({ query: { period: ['2026-11-17', '2026-11-18'] } })
    expect(start!.element.checkValidity()).toBe(true)
    expect(end!.element.checkValidity()).toBe(true)
  })

  it('renders business actions on the left and search controls on the right', async () => {
    const wrapper = mount(SchemaTablePage<Row>, {
      props: { columns, query: { keyword: 'zero' }, data: [], pagination: { page: 1, pageSize: 20, total: 0 } },
      slots: { 'toolbar-actions': () => h('button', { 'data-testid': 'create-account' }, '新建用户') },
    })

    expect(wrapper.get('.schema-table-page__toolbar-left').find('[data-testid="create-account"]').exists()).toBe(true)
    expect(wrapper.get('.schema-table-page__toolbar-right').find('[data-testid="schema-search-submit"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="schema-search-submit"]').attributes('form')).toBe(wrapper.get('form').attributes('id'))
    await wrapper.get('form').trigger('submit')
    await wrapper.get('[data-testid="schema-search-reset"]').trigger('click')
    expect(wrapper.emitted('search')).toHaveLength(1)
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('omits search UI without searchable columns and keeps an actions-only toolbar', () => {
    const plainColumns: SchemaColumn<Row>[] = [{ dataIndex: 'id', label: '编号' }]
    const withAction = mount(SchemaTablePage<Row>, {
      props: { columns: plainColumns, query: {}, data: [], pagination: { page: 1, pageSize: 20, total: 0 } },
      slots: { 'toolbar-actions': () => h('button', { 'data-testid': 'batch-import' }, '批量导入') },
    })
    expect(withAction.find('.schema-search').exists()).toBe(false)
    expect(withAction.find('.schema-table-page__toolbar-right').exists()).toBe(false)
    expect(withAction.get('.schema-table-page__toolbar-left').find('[data-testid="batch-import"]').exists()).toBe(true)

    const withoutAction = mount(SchemaTablePage<Row>, {
      props: { columns: plainColumns, query: {}, data: [], pagination: { page: 1, pageSize: 20, total: 0 } },
    })
    expect(withoutAction.find('.schema-table-page__toolbar').exists()).toBe(false)
  })

  it('renders accessible icon actions and honors disabled callbacks', async () => {
    const click = vi.fn()
    const actions: SchemaAction<Row>[] = [
      { key: 'edit', label: '编辑', icon: TestIcon, disabled: (row) => row.status !== 'ACTIVE', onClick: click },
    ]
    const wrapper = mount(SchemaTableActions<Row>, {
      props: { row: { id: '1', name: '小零', status: 'DISABLED' }, actions },
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
    })

    expect(wrapper.get('.schema-table-page__table').attributes('data-scroll-owner')).toBe('table')
    expect(wrapper.get('table').element.style.minWidth).toBe('450px')
    expect(wrapper.get<HTMLElement>('[data-slot="table-container"]').element.style.minWidth).toBe('')
    expect(wrapper.find('[data-testid="custom-name"]').exists()).toBe(true)
    expect(wrapper.get('th[data-fixed="right"]').text()).toBe('操作')
    expect(wrapper.find('td[data-fixed="right"]').exists()).toBe(true)

    await wrapper.get('nav[aria-label="分页"]').findAll('button').find((button) => button.text() === '下一页')?.trigger('click')
    expect(wrapper.emitted('page-change')?.at(-1)?.[0]).toBe(2)
  })
})
