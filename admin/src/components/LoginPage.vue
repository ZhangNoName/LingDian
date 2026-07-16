<script setup lang="ts">
import { reactive, ref } from 'vue'
import { adminSession } from '../auth/session'

const emit = defineEmits<{ loggedIn: [] }>()
const form = reactive({ username: '', password: '' })
const submitting = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    await adminSession.login(form.username, form.password)
    emit('loggedIn')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '登录失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <form class="login-card" @submit.prevent="submit">
      <p class="eyebrow">灵点点餐系统</p>
      <h1>后台管理登录</h1>
      <p class="hint">仅管理员和超级管理员可登录。</p>
      <label>账号<input v-model.trim="form.username" autocomplete="username" required /></label>
      <label>密码<input v-model="form.password" type="password" autocomplete="current-password" required /></label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="primary" :disabled="submitting" type="submit">{{ submitting ? '登录中…' : '登录' }}</button>
    </form>
  </main>
</template>
