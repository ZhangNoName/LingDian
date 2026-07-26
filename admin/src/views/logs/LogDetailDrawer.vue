<script setup lang="ts">
import type { SystemLogRecord } from '@lingdian/contracts'

defineProps<{ modelValue: boolean; log?: SystemLogRecord }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="日志详情"
    size="min(520px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-descriptions v-if="log" :column="1" border>
      <el-descriptions-item label="事件">{{ log.event }}</el-descriptions-item>
      <el-descriptions-item label="消息">{{ log.message }}</el-descriptions-item>
      <el-descriptions-item label="请求">{{ log.method || '—' }} {{ log.path || '' }}</el-descriptions-item>
      <el-descriptions-item label="请求 ID">{{ log.requestId || '—' }}</el-descriptions-item>
      <el-descriptions-item label="用户 ID">{{ log.userId || '—' }}</el-descriptions-item>
      <el-descriptions-item label="详情"><pre>{{ JSON.stringify(log.details, null, 2) }}</pre></el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>
