<script setup lang="ts">
import type { PlatformUserSummary } from '@lingdian/contracts'
import { ref, watch } from 'vue'
const props = defineProps<{ modelValue: boolean; user?: PlatformUserSummary; saving: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; submit: [password: string] }>()
const password = ref('')
watch(() => props.modelValue, (open) => { if (open) password.value = '' })
</script>
<template><el-dialog :model-value="modelValue" title="重置用户密码" width="min(460px, 92vw)" @update:model-value="emit('update:modelValue', $event)"><p class="dialog-hint">为 <strong>{{ user?.nickname || user?.username }}</strong> 设置临时密码。保存后其现有会话会立即失效，下次登录必须修改密码。</p><el-form label-position="top"><el-form-item label="临时密码" required><el-input v-model="password" type="password" show-password placeholder="至少 12 位" /></el-form-item></el-form><template #footer><el-button @click="emit('update:modelValue', false)">取消</el-button><el-button type="primary" :loading="saving" :disabled="password.length < 12" @click="emit('submit', password)">确认重置</el-button></template></el-dialog></template>
