<template>
  <section class="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <p class="text-sm font-medium text-primary">账号安全</p>
    <h2 class="mt-2 text-2xl font-semibold text-slate-900">修改密码</h2>
    <p class="mt-2 text-sm leading-6 text-slate-500">使用绑定手机号收到的验证码设置新密码，无需输入旧密码。</p>
    <form class="mt-6 space-y-5" @submit.prevent="changePassword">
      <label class="block">
        <span class="mb-2 block text-sm font-medium text-slate-700">验证码</span>
        <div class="flex gap-3">
          <input v-model.trim="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5" />
          <button type="button" class="shrink-0 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary disabled:opacity-50" :disabled="sending" @click="requestCode">{{ sending ? '发送中…' : '发送验证码' }}</button>
        </div>
      </label>
      <label class="block">
        <span class="mb-2 block text-sm font-medium text-slate-700">新密码</span>
        <input v-model="password" type="password" autocomplete="new-password" :minlength="merchantPasswordReplacementMinimum" maxlength="256" required class="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        <span class="mt-1 block text-xs text-slate-500">密码至少 12 位。</span>
      </label>
      <p v-if="statusMessage" class="text-sm" :class="hasError ? 'text-red-600' : 'text-emerald-600'">{{ statusMessage }}</p>
      <button type="submit" class="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50" :disabled="submitting || !/^\d{6}$/.test(code) || password.length < merchantPasswordReplacementMinimum">{{ submitting ? '提交中…' : '修改密码' }}</button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { merchantSession } from '@/auth/session'
import { merchantPasswordReplacementMinimum } from '@/auth/password-policy'

const router = useRouter()
const code = ref('')
const password = ref('')
const sending = ref(false)
const submitting = ref(false)
const statusMessage = ref('')
const hasError = ref(false)

async function requestCode(): Promise<void> {
  sending.value = true
  statusMessage.value = ''
  try {
    await merchantSession.requestPasswordChangeCode()
    hasError.value = false
    statusMessage.value = '验证码已发送至绑定手机号。'
  } catch (error) {
    hasError.value = true
    statusMessage.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试。'
  } finally {
    sending.value = false
  }
}

async function changePassword(): Promise<void> {
  submitting.value = true
  statusMessage.value = ''
  try {
    await merchantSession.changePassword(code.value, password.value)
    await router.replace({ name: 'login', query: { message: '密码已修改，请重新登录。' } })
  } catch (error) {
    hasError.value = true
    statusMessage.value = error instanceof Error ? error.message : '密码修改失败，请稍后重试。'
  } finally {
    submitting.value = false
  }
}
</script>
