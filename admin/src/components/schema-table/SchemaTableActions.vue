<script setup lang="ts" generic="Row extends object">
import { Button } from '@lingdian/console-ui/button'
import { computed } from 'vue'
import type { SchemaAction } from './types'

const props = defineProps<{ row: Row; actions: readonly SchemaAction<Row>[] }>()

const visibleActions = computed(() => props.actions.filter((action) =>
  typeof action.hidden === 'function' ? !action.hidden(props.row) : !action.hidden))

function disabled(action: SchemaAction<Row>): boolean {
  return typeof action.disabled === 'function' ? action.disabled(props.row) : Boolean(action.disabled)
}

function invoke(action: SchemaAction<Row>): void {
  if (!disabled(action)) void action.onClick(props.row)
}
</script>

<template>
  <div class="schema-actions">
    <Button
      v-for="action in visibleActions"
      :key="action.key"
      type="button"
      :variant="action.type === 'danger' ? 'destructive' : 'ghost'"
      size="icon-sm"
      :class="{
        'text-primary': !action.type || action.type === 'primary',
        'text-emerald-700 dark:text-emerald-300': action.type === 'success',
        'text-amber-700 dark:text-amber-300': action.type === 'warning',
        'text-muted-foreground': action.type === 'info',
      }"
      :disabled="disabled(action)"
      :aria-label="action.label"
      :title="action.label"
      @click="invoke(action)"
    >
      <component :is="action.icon" />
    </Button>
  </div>
</template>
