<script setup lang="ts" generic="Row extends object">
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
    <el-tooltip v-for="action in visibleActions" :key="action.key" :content="action.label" placement="top">
      <el-button
        text
        circle
        :type="action.type ?? 'primary'"
        :disabled="disabled(action)"
        :aria-label="action.label"
        @click="invoke(action)"
      >
        <el-icon><component :is="action.icon" /></el-icon>
      </el-button>
    </el-tooltip>
  </div>
</template>
