<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminSession } from '../auth/session'
import { firstAccessibleRoute } from '../auth/permissions'
import ThemeSwitcher from '../components/layout/ThemeSwitcher.vue'
import { getAdminAuthMessage } from '../auth/user-message'
const route = useRoute(); const router = useRouter()
const form = reactive({ username: '', password: '' }); const loading = ref(false); const error = ref('')
async function submit() { error.value = ''; loading.value = true; try { await adminSession.login(form.username, form.password); const fallback = firstAccessibleRoute(adminSession.currentUser.value?.roles ?? []); const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : fallback; await router.replace(redirect) } catch (cause) { error.value = getAdminAuthMessage(cause) } finally { loading.value = false } }
</script>

<template>
  <main class="login-view"><div class="login-theme"><ThemeSwitcher /></div><section class="login-brand"><div class="login-brand-content"><span class="brand-mark large">零</span><p class="eyebrow">LINGDIAN PLATFORM</p><h1>让每一次管理<br />都更清晰高效</h1><p>统一管理平台用户、权限与系统运行状态。</p></div></section><section class="login-form-side"><el-card class="login-card" shadow="never"><div class="login-heading"><h2>欢迎回来</h2><p>请使用管理员账号登录零点管理后台</p></div><el-alert v-if="error" :title="error" type="error" show-icon :closable="false" role="alert" /><el-form label-position="top" @submit.prevent="submit"><el-form-item label="账号" required><el-input v-model.trim="form.username" size="large" autocomplete="username" placeholder="请输入管理员账号" /></el-form-item><el-form-item label="密码" required><el-input v-model="form.password" size="large" type="password" show-password autocomplete="current-password" placeholder="请输入密码" /></el-form-item><el-button class="login-submit" type="primary" size="large" :loading="loading" :disabled="!form.username || !form.password" @click="submit">登录</el-button></el-form><p class="login-footnote">登录即代表你同意平台安全规范</p></el-card></section></main>
</template>
