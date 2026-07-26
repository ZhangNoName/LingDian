<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { adminSession } from '../auth/session'
import { changeCurrentPassword } from '../services/admin-users'
import ThemeSwitcher from '../components/layout/ThemeSwitcher.vue'
const form = reactive({ currentPassword: '', password: '', confirm: '' }); const loading = ref(false); const error = ref(''); const router = useRouter()
async function submit() { if (form.password.length < 12 || form.password !== form.confirm) { error.value = '新密码至少 12 位，且两次输入必须一致'; return } loading.value = true; error.value = ''; try { await changeCurrentPassword(form.currentPassword, form.password); ElMessage.success('密码已更新，请重新登录'); await adminSession.logout(); await router.replace('/login') } catch (cause) { error.value = cause instanceof Error ? cause.message : '密码修改失败' } finally { loading.value = false } }
</script>
<template><main class="password-change-view"><div class="login-theme"><ThemeSwitcher /></div><el-card class="password-change-card" shadow="never"><span class="brand-mark large">零</span><div class="login-heading"><h2>请先修改密码</h2><p>当前密码为临时密码，完成修改后才能继续使用管理后台。</p></div><el-alert v-if="error" :title="error" type="error" :closable="false" show-icon /><el-form label-position="top" @submit.prevent="submit"><el-form-item label="当前密码"><el-input v-model="form.currentPassword" type="password" show-password /></el-form-item><el-form-item label="新密码"><el-input v-model="form.password" type="password" show-password placeholder="至少 12 位" /></el-form-item><el-form-item label="确认新密码"><el-input v-model="form.confirm" type="password" show-password /></el-form-item><el-button type="primary" class="login-submit" :loading="loading" @click="submit">修改密码</el-button></el-form></el-card></main></template>
