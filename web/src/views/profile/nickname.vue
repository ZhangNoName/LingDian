<script setup lang="ts">
import DataActionButton from '@/components/DataActionButton.vue'
import { Input } from '@lingdian/console-ui/input'
import { Button } from '@lingdian/console-ui/button'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AccountPanel from '@/components/account/AccountPanel.vue'
import { merchantSession } from '@/auth/session'
import { merchantAuthErrorKey } from '@/auth/user-message'
import { useAccountLocale, type AccountKey } from '@/i18n/account'
const { t } = useAccountLocale(),
  nickname = ref(''),
  loading = ref(true),
  loadFailed = ref(false),
  saving = ref(false),
  message = ref<AccountKey>(),
  hasError = ref(false)
let disposed = false
async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    const result = await merchantSession.getNickname()
    if (!disposed) nickname.value = result.nickname ?? ''
  } catch {
    if (!disposed) loadFailed.value = true
  } finally {
    if (!disposed) loading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => {
  disposed = true
})
async function save() {
  if (saving.value || loading.value || loadFailed.value) return
  saving.value = true
  message.value = undefined
  try {
    const result = await merchantSession.updateNickname(nickname.value.trim())
    if (disposed) return
    nickname.value = result.nickname
    hasError.value = false
    message.value = 'nicknameSaved'
  } catch (e) {
    hasError.value = true
    message.value = merchantAuthErrorKey(e, 'nicknameFailed')
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <AccountPanel :title="t('nicknameTitle')">
    <p v-if="loading" role="status" class="account-help">{{ t('loading') }}</p>
    <div v-else-if="loadFailed" role="alert">
      <p class="text-sm text-destructive">{{ t('profileFailed') }}</p>
      <DataActionButton action="refresh" :label="t('retry')" class="mt-3" @click="load" />
    </div>
    <form v-else class="account-form" @submit.prevent="save">
      <label class="account-label">
        {{ t('nickname') }}
        <Input
          v-model="nickname"
          class="h-10"
          autocomplete="nickname"
          maxlength="32"
          required
          :disabled="saving"
        />
      </label>
      <p
        v-if="message"
        class="account-status"
        :class="hasError ? 'text-destructive' : 'text-emerald-700'"
        :role="hasError ? 'alert' : 'status'"
      >
        {{ t(message) }}
      </p>
      <Button
        size="lg" class="h-10 justify-self-start"
        type="submit"
        :disabled="saving || !nickname.trim() || nickname.trim().length > 32"
      >
        {{ t(saving ? 'saving' : 'saveNickname') }}
      </Button>
    </form>
  </AccountPanel>
</template>
<style scoped src="../../components/account/account.css"></style>
