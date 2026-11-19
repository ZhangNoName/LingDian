<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Button } from '@lingdian/console-ui/button'
import { Collapsible } from '@lingdian/console-ui/collapsible'
import { ChevronDownIcon, Package } from '@lingdian/icons/web'
import { warehouseSection, warehouseSections, warehouseSectionTarget } from '@/config/warehouse-navigation'
import { warehouseViewLockKey } from '@/config/warehouse-view-lock'
import { useLocale } from '@/i18n/locale'

defineProps<{ collapsed: boolean; label: string }>()
const emit = defineEmits<{ navigate: []; expand: [] }>()

const route = useRoute()
const { locale } = useLocale()
const activeSection = computed(() => route.name === 'warehouse' ? warehouseSection(route.query) : undefined)
const viewLock = inject(warehouseViewLockKey)
const open = ref(false)
const groupTrigger = ref<InstanceType<typeof Button>>()

watch(activeSection, (view) => {
  if (view) open.value = true
}, { immediate: true })

function isLocked(section: typeof warehouseSections[number]) {
  return section.view === activeSection.value?.view && !!viewLock?.value
}

function selectSection(event: MouseEvent, section: typeof warehouseSections[number], navigate: (event: MouseEvent) => void) {
  if (isLocked(section)) return
  navigate(event)
  emit('navigate')
}

async function expand() {
  open.value = true
  emit('expand')
  await nextTick()
  groupTrigger.value?.$el.focus()
}
</script>

<template>
  <Button
    v-if="collapsed"
    type="button"
    variant="ghost"
    class="min-h-10 w-full rounded-none"
    :class="activeSection && 'border border-primary/10 bg-primary/8 text-primary'"
    :aria-label="label"
    :title="label"
    @click="expand"
  >
    <Package aria-hidden="true" />
  </Button>
  <Collapsible v-else v-model:open="open">
    <template #trigger>
      <Button
        ref="groupTrigger"
        type="button"
        variant="ghost"
        class="min-h-10 w-full justify-start gap-3 rounded-none border border-transparent px-3"
        :class="activeSection && (open ? 'text-primary' : 'border-primary/10 bg-primary/8 text-primary')"
      >
        <Package aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate text-left">{{ label }}</span>
        <ChevronDownIcon class="size-3.5 transition-transform" :class="open && 'rotate-180'" aria-hidden="true" />
      </Button>
    </template>
    <ul class="ml-5 mt-1 space-y-0.5 border-l pl-2">
      <li v-for="section in warehouseSections" :key="section.view + (section.subview ?? '')">
        <RouterLink :to="warehouseSectionTarget(section, route.name === 'warehouse' ? route.query : {})" custom v-slot="{ href, navigate }">
          <a
            :href="isLocked(section) ? undefined : href"
            :role="isLocked(section) ? 'link' : undefined"
            :aria-disabled="isLocked(section) || undefined"
            :aria-current="activeSection === section ? 'page' : undefined"
            class="block truncate px-3 py-2 text-sm leading-5 transition-colors hover:bg-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            :class="activeSection === section && 'bg-primary/8 font-medium text-primary'"
            @click="selectSection($event, section, navigate)"
          >{{ section.label[locale] }}</a>
        </RouterLink>
      </li>
    </ul>
  </Collapsible>
</template>
