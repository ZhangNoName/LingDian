<script setup lang="ts">
import { Alert } from '@lingdian/console-ui/alert'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { PasswordInput } from '@lingdian/console-ui/input'
import { reactive, ref } from 'vue'
import { notifications } from '../components/ui/notifications'
import { useRouter } from 'vue-router'
import { adminSession } from '../auth/session'
import { changeCurrentPassword } from '../services/admin-users'
import ThemeSwitcher from '../components/layout/ThemeSwitcher.vue'
const form = reactive({ currentPassword: '', password: '', confirm: '' }); const loading = ref(false); const error = ref(''); const router = useRouter()
async function submit() { if (loading.value) return; if (form.password.length < 12 || form.password !== form.confirm) { error.value = '新密码至少 12 位，且两次输入必须一致'; return } loading.value = true; error.value = ''; try { await changeCurrentPassword(form.currentPassword, form.password); notifications.success('密码已更新，请重新登录'); await adminSession.logout(); await router.replace('/login') } catch (cause) { error.value = cause instanceof Error ? cause.message : '密码修改失败' } finally { loading.value = false } }
</script>
<template>
  <main class="password-change-view">
    <div class="login-theme"><ThemeSwitcher /></div>
    <Card class="password-change-card">
      <span class="brand-mark large">零</span>
      <div class="login-heading">
        <h2>请先修改密码</h2>
        <p>当前密码为临时密码，完成修改后才能继续使用管理后台。</p>
      </div>
      <Alert v-if="error">{{ error }}</Alert>
      <form class="admin-form" @submit.prevent="submit">
        <label for="admin-current-password">当前密码</label>
        <PasswordInput id="admin-current-password" v-model="form.currentPassword" autocomplete="current-password" required :disabled="loading" />
        <label for="admin-new-password">新密码</label>
        <PasswordInput id="admin-new-password" v-model="form.password" autocomplete="new-password" placeholder="至少 12 位" required :disabled="loading" />
        <label for="admin-confirm-password">确认新密码</label>
        <PasswordInput id="admin-confirm-password" v-model="form.confirm" autocomplete="new-password" required :disabled="loading" />
        <Button type="submit" class="login-submit" :disabled="loading">{{ loading ? '正在修改…' : '修改密码' }}</Button>
      </form>
    </Card>
  </main>
</template>
