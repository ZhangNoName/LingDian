<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Button } from '@lingdian/console-ui/button'
import { Collapsible } from '@lingdian/console-ui/collapsible'
import { ChevronDownIcon, Package } from '@lingdian/icons/web'
import { warehouseGroup, warehouseGroups, warehouseSection, warehouseSectionTarget, type WarehouseGroup } from '@/config/warehouse-navigation'
import { warehouseViewLockKey } from '@/config/warehouse-view-lock'
import { useLocale } from '@/i18n/locale'

defineProps<{ collapsed: boolean; label: string }>()
const emit = defineEmits<{ navigate: []; expand: [] }>()

const route = useRoute()
const { locale } = useLocale()
const activeSection = computed(() => route.name === 'warehouse' ? warehouseSection(route.query) : undefined)
const activeGroup = computed(() => activeSection.value && warehouseGroup(activeSection.value))
const viewLock = inject(warehouseViewLockKey)
const open = ref(false)
const groupTrigger = ref<InstanceType<typeof Button>>()

watch(activeSection, (view) => {
  if (view) open.value = true
}, { immediate: true })

function isLocked(group: WarehouseGroup) {
  return group.sections[0].view === activeSection.value?.view && !!viewLock?.value
}

function selectGroup(event: MouseEvent, group: WarehouseGroup, navigate: (event: MouseEvent) => void) {
  if (isLocked(group)) return
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
    class="min-h-10 w-full rounded-none border-l-2 border-transparent"
    :class="activeSection && 'border-l-sidebar-primary bg-sidebar-accent text-sidebar-primary'"
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
        class="min-h-10 w-full justify-start gap-3 rounded-none border-l-2 border-transparent px-3"
        :class="activeSection && (open ? 'text-sidebar-primary' : 'border-l-sidebar-primary bg-sidebar-accent text-sidebar-primary')"
      >
        <Package aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate text-left">{{ label }}</span>
        <ChevronDownIcon class="size-3.5 transition-transform" :class="open && 'rotate-180'" aria-hidden="true" />
      </Button>
    </template>
    <ul class="ml-5 mt-1 space-y-0.5 border-l pl-2">
      <li v-for="group in warehouseGroups" :key="group.sections[0].view">
        <RouterLink :to="warehouseSectionTarget(group.sections[0], route.name === 'warehouse' ? route.query : {})" custom v-slot="{ href, navigate }">
          <a
            :href="isLocked(group) ? undefined : href"
            :role="isLocked(group) ? 'link' : undefined"
            :aria-disabled="isLocked(group) || undefined"
            :aria-current="activeGroup === group ? 'location' : undefined"
            class="block truncate border-l-2 border-transparent px-3 py-2 text-sm leading-5 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-[current=location]:hover:bg-sidebar-accent"
            :class="activeGroup === group && 'border-l-sidebar-primary bg-sidebar-accent font-semibold text-sidebar-primary'"
            @click="selectGroup($event, group, navigate)"
          >{{ group.label[locale] }}</a>
        </RouterLink>
      </li>
    </ul>
  </Collapsible>
</template>
