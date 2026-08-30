<script setup lang="ts">
import type {
  AuthRole,
  CreatePlatformUserRequest,
  PlatformAccountType,
  PlatformUserQuery,
  PlatformUserStatus,
  PlatformUserSummary,
  UpdatePlatformUserRequest,
} from '@lingdian/contracts'
import { CircleCheck, CircleClose, Edit, Key } from '@lingdian/icons/admin'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { adminSession } from '../../auth/session'
import {
  SchemaTableActions,
  SchemaTablePage,
  type QueryRecord,
  type SchemaAction,
} from '../../components/schema-table'
import { DICTIONARY_CODES, dictionaryRegistry, type DictionaryOption } from '../../dictionaries'
import { createUser, listStoreOptions, listUsers, resetUserPassword, setUserStatus, updateUser } from '../../services/admin-users'
import UserEditorDrawer from './UserEditorDrawer.vue'
import UserPasswordResetDialog from './UserPasswordResetDialog.vue'
import { createUserColumns } from './user-columns'
import { accountPageConfig } from './account-page-config'

const route = useRoute()
const accountType = computed<PlatformAccountType>(() => route.meta.accountType ?? 'ADMINISTRATOR')
const pageConfig = computed(() => accountPageConfig(accountType.value))
const query = reactive<PlatformUserQuery>({ page: 1, pageSize: 20, accountType: accountType.value })
const users = ref<PlatformUserSummary[]>([])
const stores = ref<Array<{ id: string; name: string }>>([])
const roleOptions = ref<readonly DictionaryOption[]>([])
const statusOptions = ref<readonly DictionaryOption[]>([])
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const editorOpen = ref(false)
const passwordOpen = ref(false)
const selected = ref<PlatformUserSummary>()
let loadSequence = 0
const rank: Record<AuthRole, number> = { USER: 0, MERCHANT: 1, ADMIN: 2, SUPER_ADMIN: 3 }
const columns = computed(() => createUserColumns(accountType.value, stores.value))
const schemaQuery = computed<QueryRecord>({
  get: () => ({ ...query }),
  set: (value) => Object.assign(query, value),
})
const pagination = computed(() => ({ page: query.page, pageSize: query.pageSize, total: total.value }))

async function load() {
  const sequence = ++loadSequence
  loading.value = true
  error.value = ''
  try {
    const page = await listUsers(query)
    if (sequence === loadSequence) {
      users.value = page.items
      total.value = page.total
    }
  } catch (cause) {
    if (sequence === loadSequence) error.value = cause instanceof Error ? cause.message : '用户加载失败'
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function search() {
  query.page = 1
  void load()
}

function resetFilters() {
  Object.assign(query, {
    keyword: undefined,
    role: undefined as AuthRole | undefined,
    status: undefined as PlatformUserStatus | undefined,
    storeId: undefined,
    page: 1,
    accountType: accountType.value,
  })
  void load()
}

function changePage(page: number) {
  query.page = page
  void load()
}

function changePageSize(pageSize: number) {
  query.pageSize = pageSize
  query.page = 1
  void load()
}

function openCreate() {
  selected.value = undefined
  editorOpen.value = true
}

function openEdit(user: PlatformUserSummary) {
  selected.value = user
  editorOpen.value = true
}

function openPassword(user: PlatformUserSummary) {
  selected.value = user
  passwordOpen.value = true
}

function canOperate(user: PlatformUserSummary) {
  if (user.userId === adminSession.currentUser.value?.userId) return false
  const operatorRank = Math.max(...(adminSession.currentUser.value?.roles ?? []).map((role) => rank[role]), -1)
  return operatorRank > Math.max(...user.roles.map((role) => rank[role]), -1)
}

function label(options: readonly DictionaryOption[], value: string): string {
  return options.find((option) => option.value === value)?.fallbackLabel ?? value
}

function rowActions(row: PlatformUserSummary): SchemaAction<PlatformUserSummary>[] {
  return [
    { key: 'edit', label: '编辑用户', icon: Edit, disabled: !canOperate(row), onClick: openEdit },
    { key: 'password', label: '重置密码', icon: Key, disabled: !canOperate(row), onClick: openPassword },
    {
      key: 'status',
      label: row.status === 'ACTIVE' ? '停用用户' : '启用用户',
      icon: row.status === 'ACTIVE' ? CircleClose : CircleCheck,
      type: row.status === 'ACTIVE' ? 'danger' : 'success',
      disabled: !canOperate(row),
      onClick: toggleStatus,
    },
  ]
}

async function submitUser(payload: CreatePlatformUserRequest | UpdatePlatformUserRequest) {
  saving.value = true
  try {
    if (selected.value) await updateUser(selected.value.userId, payload)
    else await createUser(payload as CreatePlatformUserRequest)
    ElMessage.success(selected.value ? '用户信息已更新' : '用户已创建')
    editorOpen.value = false
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  } finally {
    saving.value = false
  }
}

async function submitPassword(password: string) {
  if (!selected.value) return
  saving.value = true
  try {
    await resetUserPassword(selected.value.userId, password)
    ElMessage.success('密码已重置')
    passwordOpen.value = false
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '密码重置失败')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(user: PlatformUserSummary) {
  const status: PlatformUserStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  try {
    await ElMessageBox.confirm(
      status === 'DISABLED' ? '停用后该用户的现有会话将立即失效，确认继续？' : '确认重新启用该账号？',
      status === 'DISABLED' ? '停用账号' : '启用账号',
      { type: 'warning' },
    )
    await setUserStatus(user.userId, status)
    ElMessage.success(status === 'DISABLED' ? '账号已停用' : '账号已启用')
    await load()
  } catch (cause) {
    if (cause !== 'cancel' && cause !== 'close') ElMessage.error(cause instanceof Error ? cause.message : '状态更新失败')
  }
}

onMounted(async () => {
  const [, storeItems, roles, statuses] = await Promise.all([
    load(),
    listStoreOptions().catch(() => []),
    dictionaryRegistry.getOptions(DICTIONARY_CODES.userRole),
    dictionaryRegistry.getOptions(DICTIONARY_CODES.userStatus),
  ])
  stores.value = storeItems
  roleOptions.value = roles
  statusOptions.value = statuses
})

watch(accountType, (value) => {
  editorOpen.value = false
  passwordOpen.value = false
  selected.value = undefined
  Object.assign(query, { keyword: undefined, role: undefined, status: undefined, storeId: undefined, page: 1, accountType: value })
  void load()
})
</script>

<template>
  <div class="list-page">
    <SchemaTablePage
      v-model:query="schemaQuery"
      :columns="columns"
      :data="users"
      :pagination="pagination"
      :loading="loading"
      :error="error"
      row-key="userId"
      empty-text="暂无符合条件的用户"
      @search="search"
      @reset="resetFilters"
      @retry="load"
      @page-change="changePage"
      @page-size-change="changePageSize"
    >
      <template #toolbar-actions>
        <el-button type="primary" @click="openCreate">{{ pageConfig.createLabel }}</el-button>
      </template>
      <template #cell-identity="{ row }">
        <div class="identity-cell">
          <el-avatar>{{ (row.nickname || row.username || '用').slice(0, 1) }}</el-avatar>
          <div><strong>{{ row.nickname || '未设置昵称' }}</strong><small>{{ row.username || '无账号' }}</small></div>
        </div>
      </template>
      <template #cell-roles="{ row }">
        <el-tag v-for="role in row.roles" :key="role" class="role-tag" effect="plain">
          {{ label(roleOptions, role) }}
        </el-tag>
      </template>
      <template #cell-status="{ row }">
        <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">
          {{ label(statusOptions, row.status) }}
        </el-tag>
      </template>
      <template #cell-actions="{ row }">
        <SchemaTableActions :row="row" :actions="rowActions(row)" />
      </template>
    </SchemaTablePage>

    <UserEditorDrawer v-model="editorOpen" :user="selected" :stores="stores" :saving="saving" :account-type="accountType" @submit="submitUser" />
    <UserPasswordResetDialog v-model="passwordOpen" :user="selected" :saving="saving" @submit="submitPassword" />
  </div>
</template>
