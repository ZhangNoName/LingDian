<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import type { SystemLogRecord } from '@lingdian/contracts'

defineProps<{ modelValue: boolean; log?: SystemLogRecord }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <Dialog :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogContent side="right">
      <DialogHeader>
        <DialogTitle>日志详情</DialogTitle>
        <DialogDescription class="sr-only">查看系统日志的事件、请求和附加信息</DialogDescription>
      </DialogHeader>
      <dl v-if="log" class="log-details">
        <dt>事件</dt><dd>{{ log.event }}</dd>
        <dt>消息</dt><dd>{{ log.message }}</dd>
        <dt>请求</dt><dd>{{ log.method || '—' }} {{ log.path || '' }}</dd>
        <dt>请求 ID</dt><dd>{{ log.requestId || '—' }}</dd>
        <dt>用户 ID</dt><dd>{{ log.userId || '—' }}</dd>
        <dt>详情</dt><dd><pre>{{ JSON.stringify(log.details, null, 2) }}</pre></dd>
      </dl>
    </DialogContent>
  </Dialog>
</template>
