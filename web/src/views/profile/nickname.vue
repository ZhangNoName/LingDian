<template>
  <section class="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <p class="text-sm font-medium text-primary">个人资料</p>
    <h2 class="mt-2 text-2xl font-semibold text-slate-900">设置昵称</h2>
    <p class="mt-2 text-sm leading-6 text-slate-500">昵称仅用于显示，可与其他用户重复。</p>
    <form class="mt-6 space-y-5" @submit.prevent="save">
      <label class="block">
        <span class="mb-2 block text-sm font-medium text-slate-700">昵称</span>
        <input v-model="nickname" type="text" autocomplete="nickname" maxlength="32" required class="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
      </label>
      <p v-if="statusMessage" class="text-sm" :class="hasError ? 'text-red-600' : 'text-emerald-600'">{{ statusMessage }}</p>
      <button type="submit" class="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50" :disabled="saving || !nickname.trim() || nickname.trim().length > 32">{{ saving ? '保存中…' : '保存昵称' }}</button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { merchantSession } from '@/auth/session'

const nickname = ref('')
const saving = ref(false)
const statusMessage = ref('')
const hasError = ref(false)

async function save(): Promise<void> {
  saving.value = true
  statusMessage.value = ''
  try {
    const result = await merchantSession.updateNickname(nickname.value.trim())
    nickname.value = result.nickname
    hasError.value = false
    statusMessage.value = '昵称已保存。'
  } catch (error) {
    hasError.value = true
    statusMessage.value = error instanceof Error ? error.message : '昵称保存失败，请稍后重试。'
  } finally {
    saving.value = false
  }
}
</script>
