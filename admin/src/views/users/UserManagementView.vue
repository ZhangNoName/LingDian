<script setup lang="ts">
import { Badge } from '@lingdian/console-ui/badge'
import { Button } from '@lingdian/console-ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
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
import { notifications } from '../../components/ui/notifications'
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
const statusTarget = ref<PlatformUserSummary>()
const savingStatus = ref(false)
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
      onClick: () => { statusTarget.value = row },
    },
  ]
}

async function submitUser(payload: CreatePlatformUserRequest | UpdatePlatformUserRequest) {
  saving.value = true
  try {
    if (selected.value) await updateUser(selected.value.userId, payload)
    else await createUser(payload as CreatePlatformUserRequest)
    notifications.success(selected.value ? '用户信息已更新' : '用户已创建')
    editorOpen.value = false
    await load()
  } catch (cause) {
    notifications.error(cause instanceof Error ? cause.message : '操作失败')
  } finally {
    saving.value = false
  }
}

async function submitPassword(password: string) {
  if (!selected.value) return
  saving.value = true
  try {
    await resetUserPassword(selected.value.userId, password)
    notifications.success('密码已重置')
    passwordOpen.value = false
  } catch (cause) {
    notifications.error(cause instanceof Error ? cause.message : '密码重置失败')
  } finally {
    saving.value = false
  }
}

async function toggleStatus() {
  const user = statusTarget.value
  if (!user || savingStatus.value) return
  const status: PlatformUserStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  savingStatus.value = true
  try {
    await setUserStatus(user.userId, status)
    notifications.success(status === 'DISABLED' ? '账号已停用' : '账号已启用')
    statusTarget.value = undefined
    await load()
  } catch (cause) {
    notifications.error(cause instanceof Error ? cause.message : '状态更新失败')
  } finally {
    savingStatus.value = false
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
  statusTarget.value = undefined
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
        <Button type="button" @click="openCreate">{{ pageConfig.createLabel }}</Button>
      </template>
      <template #cell-identity="{ row }">
        <div class="identity-cell">
          <span class="avatar identity-avatar" aria-hidden="true">{{ (row.nickname || row.username || '用').slice(0, 1) }}</span>
          <div><strong>{{ row.nickname || row.username || '未设置昵称' }}</strong><small v-if="row.nickname && row.username">{{ row.username }}</small></div>
        </div>
      </template>
      <template #cell-roles="{ row }">
        <Badge v-for="role in row.roles" :key="role" class="role-tag" variant="outline">
          {{ label(roleOptions, role) }}
        </Badge>
      </template>
      <template #cell-status="{ row }">
        <Badge :variant="row.status === 'ACTIVE' ? 'success' : 'secondary'">
          {{ label(statusOptions, row.status) }}
        </Badge>
      </template>
      <template #cell-actions="{ row }">
        <SchemaTableActions :row="row" :actions="rowActions(row)" />
      </template>
    </SchemaTablePage>

    <UserEditorDrawer v-model="editorOpen" :user="selected" :stores="stores" :saving="saving" :account-type="accountType" @submit="submitUser" />
    <UserPasswordResetDialog v-model="passwordOpen" :user="selected" :saving="saving" @submit="submitPassword" />
    <Dialog :open="Boolean(statusTarget)" @update:open="!$event && !savingStatus && (statusTarget = undefined)">
      <DialogContent class="w-[min(460px,92vw)]" :close-disabled="savingStatus">
        <DialogHeader>
          <DialogTitle>{{ statusTarget?.status === 'ACTIVE' ? '停用账号' : '启用账号' }}</DialogTitle>
          <DialogDescription>
            {{ statusTarget?.status === 'ACTIVE' ? '停用后该用户的现有会话将立即失效，确认继续？' : '确认重新启用该账号？' }}
          </DialogDescription>
        </DialogHeader>
        <div class="admin-dialog-actions">
          <Button type="button" variant="outline" :disabled="savingStatus" @click="statusTarget = undefined">取消</Button>
          <Button type="button" :variant="statusTarget?.status === 'ACTIVE' ? 'destructive' : 'default'" :disabled="savingStatus" @click="toggleStatus">
            {{ savingStatus ? '正在保存…' : '确认' }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
