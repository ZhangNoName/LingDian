<script setup lang="ts">
import type { AuthRole, CreatePlatformUserRequest, PlatformUserQuery, PlatformUserStatus, PlatformUserSummary, UpdatePlatformUserRequest } from '@lingdian/contracts'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { adminSession } from '../../auth/session'
import PageError from '../../components/common/PageError.vue'
import PageHeader from '../../components/common/PageHeader.vue'
import { createUser, listStoreOptions, listUsers, resetUserPassword, setUserStatus, updateUser } from '../../services/admin-users'
import UserEditorDrawer from './UserEditorDrawer.vue'
import UserPasswordResetDialog from './UserPasswordResetDialog.vue'

const query = reactive<PlatformUserQuery>({ page: 1, pageSize: 20 })
const users = ref<PlatformUserSummary[]>([])
const stores = ref<Array<{ id: string; name: string }>>([])
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const editorOpen = ref(false)
const passwordOpen = ref(false)
const selected = ref<PlatformUserSummary>()
const roleLabels: Record<AuthRole, string> = { SUPER_ADMIN: '超级管理员', ADMIN: '管理员', MERCHANT: '商家', USER: '普通用户' }
const rank: Record<AuthRole, number> = { USER: 0, MERCHANT: 1, ADMIN: 2, SUPER_ADMIN: 3 }

async function load() {
  loading.value = true; error.value = ''
  try { const page = await listUsers(query); users.value = page.items; total.value = page.total }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '用户加载失败' }
  finally { loading.value = false }
}
function search() { query.page = 1; void load() }
function resetFilters() { Object.assign(query, { keyword: undefined, role: undefined as AuthRole | undefined, status: undefined as PlatformUserStatus | undefined, storeId: undefined, page: 1 }); void load() }
function openCreate() { selected.value = undefined; editorOpen.value = true }
function openEdit(user: PlatformUserSummary) { selected.value = user; editorOpen.value = true }
function openPassword(user: PlatformUserSummary) { selected.value = user; passwordOpen.value = true }
function canOperate(user: PlatformUserSummary) {
  if (user.userId === adminSession.currentUser.value?.userId) return false
  const operatorRank = Math.max(...(adminSession.currentUser.value?.roles ?? []).map((role) => rank[role]), -1)
  return operatorRank > Math.max(...user.roles.map((role) => rank[role]), -1)
}
async function submitUser(payload: CreatePlatformUserRequest | UpdatePlatformUserRequest) {
  saving.value = true
  try { if (selected.value) await updateUser(selected.value.userId, payload); else await createUser(payload as CreatePlatformUserRequest); ElMessage.success(selected.value ? '用户信息已更新' : '用户已创建'); editorOpen.value = false; await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '操作失败') }
  finally { saving.value = false }
}
async function submitPassword(password: string) {
  if (!selected.value) return
  saving.value = true
  try { await resetUserPassword(selected.value.userId, password); ElMessage.success('密码已重置'); passwordOpen.value = false }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '密码重置失败') }
  finally { saving.value = false }
}
async function toggleStatus(user: PlatformUserSummary) {
  const status: PlatformUserStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  try { await ElMessageBox.confirm(status === 'DISABLED' ? '停用后该用户的现有会话将立即失效，确认继续？' : '确认重新启用该账号？', status === 'DISABLED' ? '停用账号' : '启用账号', { type: 'warning' }); await setUserStatus(user.userId, status); ElMessage.success(status === 'DISABLED' ? '账号已停用' : '账号已启用'); await load() }
  catch (cause) { if (cause !== 'cancel' && cause !== 'close') ElMessage.error(cause instanceof Error ? cause.message : '状态更新失败') }
}
onMounted(async () => { await Promise.all([load(), listStoreOptions().then((items) => { stores.value = items }).catch(() => { stores.value = [] })]) })
</script>

<template>
  <div class="page-stack">
    <PageHeader title="用户管理" description="统一查看和管理全平台账号、角色与状态。"><template #actions><el-button type="primary" @click="openCreate">新建用户</el-button></template></PageHeader>
    <el-card shadow="never"><el-form class="filter-form" inline @submit.prevent="search"><el-form-item label="关键词"><el-input v-model="query.keyword" clearable placeholder="昵称 / 账号 / 手机号" /></el-form-item><el-form-item label="角色"><el-select v-model="query.role" clearable placeholder="全部角色"><el-option v-for="(label, value) in roleLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item><el-form-item label="状态"><el-select v-model="query.status" clearable placeholder="全部状态"><el-option label="正常" value="ACTIVE" /><el-option label="已停用" value="DISABLED" /></el-select></el-form-item><el-form-item label="门店"><el-select v-model="query.storeId" clearable filterable placeholder="全部门店"><el-option v-for="store in stores" :key="store.id" :label="store.name" :value="store.id" /></el-select></el-form-item><el-form-item><el-button type="primary" @click="search">查询</el-button><el-button @click="resetFilters">重置</el-button></el-form-item></el-form></el-card>
    <PageError v-if="error" :message="error" @retry="load" />
    <el-card class="table-card" shadow="never"><el-table v-loading="loading" :data="users" row-key="userId"><el-table-column label="用户" min-width="190"><template #default="{ row }"><div class="identity-cell"><el-avatar>{{ (row.nickname || row.username || '用').slice(0, 1) }}</el-avatar><div><strong>{{ row.nickname || '未设置昵称' }}</strong><small>{{ row.username || '无账号' }}</small></div></div></template></el-table-column><el-table-column prop="phone" label="手机号" min-width="145" /><el-table-column label="角色" min-width="190"><template #default="{ row }"><el-tag v-for="role in row.roles" :key="role" class="role-tag" effect="plain">{{ roleLabels[role as AuthRole] }}</el-tag></template></el-table-column><el-table-column label="门店范围" min-width="130"><template #default="{ row }">{{ row.storeIds.length ? `${row.storeIds.length} 个门店` : '—' }}</template></el-table-column><el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '正常' : '已停用' }}</el-tag></template></el-table-column><el-table-column label="最近登录" min-width="170"><template #default="{ row }">{{ row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : '从未登录' }}</template></el-table-column><el-table-column label="操作" fixed="right" width="230"><template #default="{ row }"><el-button link type="primary" :disabled="!canOperate(row)" @click="openEdit(row)">编辑</el-button><el-button link :disabled="!canOperate(row)" @click="openPassword(row)">重置密码</el-button><el-button link :type="row.status === 'ACTIVE' ? 'danger' : 'success'" :disabled="!canOperate(row)" @click="toggleStatus(row)">{{ row.status === 'ACTIVE' ? '停用' : '启用' }}</el-button></template></el-table-column><template #empty><el-empty description="暂无符合条件的用户" /></template></el-table><div class="pagination"><el-pagination v-model:current-page="query.page" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="total" @current-change="load" /></div></el-card>
    <UserEditorDrawer v-model="editorOpen" :user="selected" :stores="stores" :saving="saving" @submit="submitUser" />
    <UserPasswordResetDialog v-model="passwordOpen" :user="selected" :saving="saving" @submit="submitPassword" />
  </div>
</template>
