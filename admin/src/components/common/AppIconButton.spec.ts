import ElementPlus from 'element-plus'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import AppIconButton from './AppIconButton.vue'

const TestIcon = defineComponent({ setup: () => () => h('svg', { 'data-testid': 'test-icon' }) })

describe('AppIconButton', () => {
  it('renders aligned icon and text while forwarding Element Plus button behavior', async () => {
    const click = vi.fn()
    const wrapper = mount(AppIconButton, {
      props: { icon: TestIcon },
      attrs: { type: 'primary', onClick: click },
      slots: { default: () => '搜索' },
      global: { plugins: [ElementPlus] },
    })

    expect(wrapper.get('.icon-button__icon').find('[data-testid="test-icon"]').exists()).toBe(true)
    expect(wrapper.get('.icon-button__label').text()).toBe('搜索')
    expect(wrapper.get('button').classes()).toContain('el-button--primary')
    await wrapper.get('button').trigger('click')
    expect(click).toHaveBeenCalledOnce()
  })
})
