<script setup lang="ts">
import { Alert } from '@lingdian/console-ui/alert'
import { Button } from '@lingdian/console-ui/button'
import { ComboboxField } from '@lingdian/console-ui/combobox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { Checkbox, Input, PasswordInput } from '@lingdian/console-ui/input'
import type { AuthRole, CreatePlatformUserRequest, PlatformAccountType, PlatformUserSummary, UpdatePlatformUserRequest } from '@lingdian/contracts'
import { computed, reactive, watch } from 'vue'
import { accountPageConfig } from './account-page-config'
import { normalizeUserForm, validateUserForm, type UserFormState } from './user-form'

const props = defineProps<{ modelValue: boolean; user?: PlatformUserSummary; stores: Array<{ id: string; name: string }>; saving: boolean; accountType: PlatformAccountType }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; submit: [payload: CreatePlatformUserRequest | UpdatePlatformUserRequest] }>()
const form = reactive<UserFormState>({ nickname: '', username: '', phone: '', password: '', roles: ['USER'], storeIds: [] })
const errors = computed(() => validateUserForm(form, !props.user))
const config = computed(() => accountPageConfig(props.accountType))
const roleLabels: Record<AuthRole, string> = { ADMIN: '管理员', SUPER_ADMIN: '超级管理员', MERCHANT: '商家', USER: '普通用户' }
const roleOptions = computed(() => config.value.defaultRoles.map((value) => ({ value, label: roleLabels[value] })))

watch(() => [props.modelValue, props.user] as const, () => {
  if (!props.modelValue) return
  Object.assign(form, props.user
    ? { nickname: props.user.nickname ?? '', username: props.user.username ?? '', phone: props.user.phone ?? '', password: '', roles: [...props.user.roles], storeIds: [...props.user.storeIds] }
    : { nickname: '', username: '', phone: '', password: '', roles: [...config.value.defaultRoles], storeIds: [] })
}, { immediate: true })

function submit() {
  if (props.saving || errors.value.length) return
  const value = normalizeUserForm(form)
  if (props.user) emit('submit', { nickname: value.nickname, username: value.username, phone: value.phone, roles: value.roles, storeIds: value.storeIds })
  else emit('submit', value)
}
</script>

<template>
  <Dialog :open="modelValue" @update:open="!saving && emit('update:modelValue', $event)">
    <DialogContent side="right" :close-disabled="saving">
      <DialogHeader>
        <DialogTitle>{{ user ? `编辑${config.entityLabel}` : config.createLabel }}</DialogTitle>
        <DialogDescription class="sr-only">管理平台账号资料与权限</DialogDescription>
      </DialogHeader>
      <form class="admin-form mt-4" @submit.prevent="submit">
        <fieldset :disabled="saving" class="admin-form">
          <label for="account-editor-nickname">昵称</label>
          <Input id="account-editor-nickname" v-model="form.nickname" maxlength="32" placeholder="平台内展示名称" />
          <label for="account-editor-username">账号</label>
          <Input id="account-editor-username" v-model="form.username" required :disabled="Boolean(user)" placeholder="3–64 位小写账号" />
          <label for="account-editor-phone">手机号</label>
          <Input id="account-editor-phone" v-model="form.phone" required type="tel" placeholder="用于身份验证" />
          <template v-if="!user">
            <label for="account-editor-password">初始密码</label>
            <PasswordInput id="account-editor-password" v-model="form.password" autocomplete="new-password" required placeholder="至少 12 位" />
          </template>
          <fieldset class="admin-role-options">
            <legend>角色</legend>
            <label v-for="role in roleOptions" :key="role.value" class="flex items-center gap-2">
              <Checkbox
                :model-value="form.roles.includes(role.value)"
                @update:model-value="form.roles = $event ? [...form.roles, role.value] : form.roles.filter((value) => value !== role.value)"
              />
              {{ role.label }}
            </label>
          </fieldset>
          <div v-if="form.roles.includes('MERCHANT')" class="grid gap-1.5">
            <span class="text-sm">允许门店</span>
            <ComboboxField
              :model-value="form.storeIds"
              multiple
              label="允许门店"
              placeholder="至少选择一个门店"
              :options="stores.map((store) => ({ value: store.id, label: store.name }))"
              :disabled="saving"
              @update:model-value="Array.isArray($event) && (form.storeIds = $event)"
            />
          </div>
          <Alert v-if="errors.length" variant="warning">{{ errors[0] }}</Alert>
        </fieldset>
        <div class="admin-dialog-actions">
          <Button type="button" variant="outline" :disabled="saving" @click="emit('update:modelValue', false)">取消</Button>
          <Button type="submit" :disabled="saving || errors.length > 0">
            {{ saving ? '正在保存…' : user ? '保存更改' : config.createLabel }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
