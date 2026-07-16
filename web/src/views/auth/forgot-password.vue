<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p class="text-sm font-medium text-primary">灵点点餐系统</p>
      <h1 class="mt-2 text-2xl font-semibold text-slate-900">忘记密码</h1>
      <p class="mt-2 text-sm leading-6 text-slate-500">验证码将发送至该商家账号已绑定的手机号。</p>

      <form class="mt-8 space-y-5" @submit.prevent="resetPassword">
        <label class="block">
          <span class="mb-2 block text-sm font-medium text-slate-700">商家账号</span>
          <input v-model.trim="username" type="text" autocomplete="username" minlength="3" maxlength="64" required class="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        </label>
        <label class="block">
          <span class="mb-2 block text-sm font-medium text-slate-700">验证码</span>
          <div class="flex gap-3">
            <input v-model.trim="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5" />
            <button type="button" class="shrink-0 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary disabled:opacity-50" :disabled="sending || username.length < 3" @click="requestCode">
              {{ sending ? '发送中…' : '发送验证码' }}
            </button>
          </div>
        </label>
        <label class="block">
          <span class="mb-2 block text-sm font-medium text-slate-700">新密码</span>
          <input v-model="password" type="password" autocomplete="new-password" :minlength="merchantPasswordReplacementMinimum" maxlength="256" required class="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          <span class="mt-1 block text-xs text-slate-500">密码至少 12 位。</span>
        </label>
        <p v-if="statusMessage" class="text-sm" :class="hasError ? 'text-red-600' : 'text-emerald-600'">{{ statusMessage }}</p>
        <button type="submit" class="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50" :disabled="submitting || username.length < 3 || !/^\d{6}$/.test(code) || password.length < merchantPasswordReplacementMinimum">
          {{ submitting ? '提交中…' : '重设密码' }}
        </button>
      </form>
      <RouterLink class="mt-5 inline-block text-sm font-medium text-primary hover:underline" :to="{ name: 'login' }">返回登录</RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { merchantSession } from '@/auth/session'
import { merchantPasswordReplacementMinimum } from '@/auth/password-policy'

const router = useRouter()
const username = ref('')
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
    await merchantSession.requestPasswordReset(username.value)
    hasError.value = false
    statusMessage.value = '如账号可重设密码，验证码已发送至绑定手机号。'
  } catch (error) {
    hasError.value = true
    statusMessage.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试。'
  } finally {
    sending.value = false
  }
}

async function resetPassword(): Promise<void> {
  submitting.value = true
  statusMessage.value = ''
  try {
    await merchantSession.resetPassword(username.value, code.value, password.value)
    await router.replace({ name: 'login', query: { message: '密码已重设，请重新登录。' } })
  } catch (error) {
    hasError.value = true
    statusMessage.value = error instanceof Error ? error.message : '密码重设失败，请稍后重试。'
  } finally {
    submitting.value = false
  }
}
</script>
