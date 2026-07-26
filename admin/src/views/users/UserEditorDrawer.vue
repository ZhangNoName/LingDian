<script setup lang="ts">
import type { AuthRole, CreatePlatformUserRequest, PlatformUserSummary, UpdatePlatformUserRequest } from '@lingdian/contracts'
import { computed, reactive, watch } from 'vue'
import { adminSession } from '../../auth/session'
import { normalizeUserForm, validateUserForm, type UserFormState } from './user-form'

const props = defineProps<{ modelValue: boolean; user?: PlatformUserSummary; stores: Array<{ id: string; name: string }>; saving: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; submit: [payload: CreatePlatformUserRequest | UpdatePlatformUserRequest] }>()
const form = reactive<UserFormState>({ nickname: '', username: '', phone: '', password: '', roles: ['USER'], storeIds: [] })
const errors = computed(() => validateUserForm(form, !props.user))
const roleOptions = computed<Array<{ value: AuthRole; label: string }>>(() => adminSession.currentUser.value?.roles.includes('SUPER_ADMIN')
  ? [{ value: 'ADMIN', label: '管理员' }, { value: 'MERCHANT', label: '商家' }, { value: 'USER', label: '普通用户' }]
  : [{ value: 'MERCHANT', label: '商家' }, { value: 'USER', label: '普通用户' }])

watch(() => [props.modelValue, props.user] as const, () => {
  if (!props.modelValue) return
  Object.assign(form, props.user
    ? { nickname: props.user.nickname ?? '', username: props.user.username ?? '', phone: props.user.phone ?? '', password: '', roles: [...props.user.roles], storeIds: [...props.user.storeIds] }
    : { nickname: '', username: '', phone: '', password: '', roles: ['USER'], storeIds: [] })
}, { immediate: true })

function submit() {
  if (errors.value.length) return
  const value = normalizeUserForm(form)
  if (props.user) emit('submit', { nickname: value.nickname, username: value.username, phone: value.phone, roles: value.roles, storeIds: value.storeIds })
  else emit('submit', value)
}
</script>

<template>
  <el-drawer :model-value="modelValue" :title="user ? '编辑用户' : '新建用户'" size="min(520px, 100%)" destroy-on-close @update:model-value="emit('update:modelValue', $event)">
    <el-form label-position="top" class="drawer-form" @submit.prevent="submit">
      <el-form-item label="昵称"><el-input v-model="form.nickname" maxlength="32" placeholder="平台内展示名称" /></el-form-item>
      <el-form-item label="账号" required><el-input v-model="form.username" :disabled="Boolean(user)" placeholder="3–64 位小写账号" /></el-form-item>
      <el-form-item label="手机号" required><el-input v-model="form.phone" placeholder="用于身份验证" /></el-form-item>
      <el-form-item v-if="!user" label="初始密码" required><el-input v-model="form.password" type="password" show-password placeholder="至少 12 位" /></el-form-item>
      <el-form-item label="角色" required><el-checkbox-group v-model="form.roles"><el-checkbox v-for="role in roleOptions" :key="role.value" :value="role.value">{{ role.label }}</el-checkbox></el-checkbox-group></el-form-item>
      <el-form-item v-if="form.roles.includes('MERCHANT')" label="允许门店" required><el-select v-model="form.storeIds" multiple filterable placeholder="至少选择一个门店"><el-option v-for="store in stores" :key="store.id" :label="store.name" :value="store.id" /></el-select></el-form-item>
      <el-alert v-if="errors.length" :title="errors[0]" type="warning" :closable="false" show-icon />
    </el-form>
    <template #footer><el-button @click="emit('update:modelValue', false)">取消</el-button><el-button type="primary" :loading="saving" :disabled="errors.length > 0" @click="submit">{{ user ? '保存更改' : '创建用户' }}</el-button></template>
  </el-drawer>
</template>
