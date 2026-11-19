<script setup lang="ts">
import { Alert } from '@lingdian/console-ui/alert'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { Input, PasswordInput } from '@lingdian/console-ui/input'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminSession } from '../auth/session'
import { firstAccessibleRoute } from '../auth/permissions'
import ThemeSwitcher from '../components/layout/ThemeSwitcher.vue'
import { getAdminAuthMessage } from '../auth/user-message'
import { safeInternalRedirect } from '../auth/redirect'
const route = useRoute(); const router = useRouter()
const form = reactive({ username: '', password: '' }); const loading = ref(false); const error = ref('')
async function submit() { if (loading.value) return; error.value = ''; loading.value = true; try { await adminSession.login(form.username, form.password); const fallback = firstAccessibleRoute(adminSession.currentUser.value?.roles ?? []); await router.replace(safeInternalRedirect(route.query.redirect, fallback)) } catch (cause) { error.value = getAdminAuthMessage(cause) } finally { loading.value = false } }
</script>

<template>
  <main class="login-view">
    <div class="login-theme"><ThemeSwitcher /></div>
    <section class="login-form-side">
      <Card class="login-card">
        <div class="login-heading">
          <h1>零点平台登录</h1>
        </div>
        <Alert v-if="error">{{ error }}</Alert>
        <form class="admin-form" @submit.prevent="submit">
          <label for="admin-login-username">账号</label>
          <Input id="admin-login-username" v-model.trim="form.username" class="h-9" autocomplete="username" placeholder="请输入管理员账号" required :disabled="loading" />
          <label for="admin-login-password">密码</label>
          <PasswordInput id="admin-login-password" v-model="form.password" autocomplete="current-password" placeholder="请输入密码" required :disabled="loading" />
          <Button class="login-submit" type="submit" size="lg" :disabled="loading || !form.username || !form.password">
            {{ loading ? '登录中…' : '登录' }}
          </Button>
        </form>
      </Card>
    </section>
  </main>
</template>
