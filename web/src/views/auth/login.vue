<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p class="text-sm font-medium text-primary">灵点点餐系统</p>
      <h1 class="mt-2 text-2xl font-semibold text-slate-900">商家登录</h1>
      <p class="mt-2 text-sm leading-6 text-slate-500">使用已由超级管理员创建的商家账号登录。</p>

      <form class="mt-8 space-y-5" @submit.prevent="login">
        <label class="block">
          <span class="mb-2 block text-sm font-medium text-slate-700">账号</span>
          <input
            v-model.trim="username"
            type="text"
            autocomplete="username"
            minlength="3"
            maxlength="64"
            placeholder="请输入商家账号"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            required
          />
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-medium text-slate-700">密码</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            :minlength="merchantLoginPasswordMinimum"
            maxlength="256"
            placeholder="请输入密码"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            required
          />
        </label>

        <p v-if="statusMessage" class="text-sm text-red-600" role="alert" aria-live="assertive">{{ statusMessage }}</p>

        <button
          type="submit"
          class="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loggingIn || !username || password.length < merchantLoginPasswordMinimum"
        >
          {{ loggingIn ? '登录中…' : '登录' }}
        </button>
      </form>

      <RouterLink class="mt-5 inline-block text-sm font-medium text-primary hover:underline" :to="{ name: 'forgot-password' }">
        忘记密码？
      </RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { merchantSession } from '@/auth/session'
import { merchantLoginPasswordMinimum } from '@/auth/password-policy'
import { getMerchantAuthMessage } from '@/auth/user-message'

const router = useRouter()
const route = useRoute()
const username = ref('')
const password = ref('')
const loggingIn = ref(false)
const statusMessage = ref('')

async function login(): Promise<void> {
  loggingIn.value = true
  statusMessage.value = ''

  try {
    await merchantSession.login(username.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (error) {
    statusMessage.value = getMerchantAuthMessage(error)
  } finally {
    loggingIn.value = false
  }
}
</script>
