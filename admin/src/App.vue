<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { canManageMerchants } from './auth/access'
import { adminSession } from './auth/session'
import LoginPage from './components/LoginPage.vue'
import MerchantAccountsPage from './components/MerchantAccountsPage.vue'
import ProfileNicknamePage from './components/ProfileNicknamePage.vue'
import SystemLogsPage from './components/SystemLogsPage.vue'

const ready = ref(false)
const page = ref<'merchants' | 'profile' | 'logs'>('merchants')

onMounted(async () => {
  await adminSession.ensureAccessToken()
  ready.value = true
})

function loggedIn() {
  page.value = canManageMerchants(adminSession.currentUser.value?.roles ?? []) ? 'merchants' : 'profile'
}
</script>

<template>
  <main v-if="!ready" class="login-page">正在恢复会话…</main>
  <LoginPage v-else-if="!adminSession.accessToken.value" @logged-in="loggedIn" />
  <main v-else class="shell">
    <header class="topbar"><div><p class="eyebrow">灵点点餐系统</p><h1>后台管理</h1></div><nav><button v-if="canManageMerchants(adminSession.currentUser.value?.roles ?? [])" :class="{ active: page === 'merchants' }" @click="page = 'merchants'">商家账号</button><button :class="{ active: page === 'profile' }" @click="page = 'profile'">我的昵称</button><button @click="adminSession.logout">退出登录</button></nav></header>
    <button v-if="canManageMerchants(adminSession.currentUser.value?.roles ?? [])" class="logs-nav" :class="{ active: page === 'logs' }" @click="page = 'logs'">系统日志</button>
    <SystemLogsPage v-if="page === 'logs' && canManageMerchants(adminSession.currentUser.value?.roles ?? [])" />
    <MerchantAccountsPage v-else-if="page === 'merchants' && canManageMerchants(adminSession.currentUser.value?.roles ?? [])" />
    <ProfileNicknamePage v-else />
  </main>
</template>
