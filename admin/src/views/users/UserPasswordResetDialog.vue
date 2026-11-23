<script setup lang="ts">
import { Button } from '@lingdian/console-ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { PasswordInput } from '@lingdian/console-ui/input'
import type { PlatformUserSummary } from '@lingdian/contracts'
import { ref, watch } from 'vue'
const props = defineProps<{ modelValue: boolean; user?: PlatformUserSummary; saving: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; submit: [password: string] }>()
const password = ref('')
watch(() => props.modelValue, (open) => { if (open) password.value = '' })
</script>
<template>
  <Dialog :open="modelValue" @update:open="!saving && emit('update:modelValue', $event)">
    <DialogContent class="w-[min(460px,92vw)]" :close-disabled="saving">
      <DialogHeader>
        <DialogTitle>重置用户密码</DialogTitle>
        <DialogDescription>
          为 <strong>{{ user?.nickname || user?.username }}</strong> 设置临时密码。保存后其现有会话会立即失效，下次登录必须修改密码。
        </DialogDescription>
      </DialogHeader>
      <form class="admin-form" @submit.prevent="!saving && password.length >= 12 && emit('submit', password)">
        <label for="account-temp-password">临时密码</label>
        <PasswordInput id="account-temp-password" v-model="password" autocomplete="new-password" placeholder="至少 12 位" minlength="12" required :disabled="saving" />
        <div class="admin-dialog-actions">
          <Button type="button" variant="outline" :disabled="saving" @click="emit('update:modelValue', false)">取消</Button>
          <Button type="submit" :disabled="saving || password.length < 12">{{ saving ? '正在重置…' : '确认重置' }}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
