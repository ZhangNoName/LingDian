<template>
  <el-form
    :model="model"
    :inline="inline"
    :label-position="labelPosition"
    :label-width="labelWidth"
    class="app-form"
  >
    <div class="app-form__body" :style="gridStyle">
      <slot />
    </div>
    <div v-if="$slots.actions" class="app-form__actions">
      <slot name="actions" />
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElForm } from 'element-plus'

const props = withDefaults(
  defineProps<{
    model?: Record<string, unknown>
    columns?: number
    inline?: boolean
    labelPosition?: 'left' | 'right' | 'top'
    labelWidth?: string | number
  }>(),
  {
    model: () => ({}),
    columns: 4,
    inline: false,
    labelPosition: 'top',
    labelWidth: 'auto',
  },
)

const gridStyle = computed(() => ({
  '--form-columns': props.columns,
}))
</script>

<style scoped>
.app-form {
  display: grid;
  gap: 12px;
}

.app-form__body {
  display: grid;
  grid-template-columns: repeat(var(--form-columns), minmax(0, 1fr));
  gap: 12px 16px;
}

.app-form__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

@media (max-width: 1280px) {
  .app-form__body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .app-form__body {
    grid-template-columns: 1fr;
  }
}
</style>
