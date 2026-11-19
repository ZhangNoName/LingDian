<script setup lang="ts">
import { Input } from '@lingdian/console-ui/input'
import { Button } from '@lingdian/console-ui/button'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AccountPanel from '@/components/account/AccountPanel.vue'
import PasswordField from '@/components/account/PasswordField.vue'
import { merchantSession } from '@/auth/session'
import { merchantPasswordReplacementMinimum } from '@/auth/password-policy'
import { merchantAuthErrorKey } from '@/auth/user-message'
import { useAccountLocale, type AccountKey } from '@/i18n/account'
const { t } = useAccountLocale(),
  router = useRouter(),
  code = ref(''),
  password = ref(''),
  sending = ref(false),
  submitting = ref(false),
  message = ref<AccountKey>(),
  hasError = ref(false)
const forced = merchantSession.getUser()?.mustChangePassword
async function requestCode() {
  if (sending.value || submitting.value) return
  sending.value = true
  message.value = undefined
  try {
    await merchantSession.requestPasswordChangeCode()
    hasError.value = false
    message.value = 'codeSent'
  } catch (e) {
    hasError.value = true
    message.value = merchantAuthErrorKey(e, 'codeFailed')
  } finally {
    sending.value = false
  }
}
async function changePassword() {
  if (submitting.value || sending.value) return
  submitting.value = true
  message.value = undefined
  try {
    await merchantSession.changePassword(code.value, password.value)
    password.value = ''
    code.value = ''
    await router.replace({ name: 'login', query: { notice: 'password-changed' } })
  } catch (e) {
    hasError.value = true
    message.value = merchantAuthErrorKey(e, 'changeFailed')
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <AccountPanel :title="t('security')" :description="t('changeHint')">
    <p v-if="forced" role="status" class="mb-5 rounded-md border border-amber-200 p-3 text-sm">
      {{ t('forcedChange') }}
    </p>
    <form class="account-form" @submit.prevent="changePassword">
      <fieldset :disabled="submitting || sending" class="grid min-w-0 gap-5">
        <div>
          <label for="change-code" class="account-label">{{ t('code') }}</label>
          <div class="mt-2 flex min-w-0 gap-2">
            <Input
              id="change-code"
              v-model.trim="code"
              class="h-10 grow"
              inputmode="numeric"
              autocomplete="one-time-code"
              pattern="[0-9]{6}"
              maxlength="6"
              required
            />
            <Button variant="outline" size="lg" class="h-10" type="button" :disabled="sending" @click="requestCode">
              {{ t(sending ? 'sending' : 'sendCode') }}
            </Button>
          </div>
        </div>
        <div>
          <PasswordField
            v-model="password"
            :label="t('newPassword')"
            autocomplete="new-password"
            :minlength="merchantPasswordReplacementMinimum"
            :disabled="submitting || sending"
          />
          <p class="account-help mt-2">{{ t('passwordHint') }}</p>
        </div>
      </fieldset>
      <p
        v-if="message"
        class="account-status"
        :class="hasError ? 'text-destructive' : 'text-emerald-700'"
        :role="hasError ? 'alert' : 'status'"
      >
        {{ t(message) }}
      </p>
      <Button
        size="lg" class="h-10"
        type="submit"
        :disabled="
          submitting || sending || !/^\d{6}$/.test(code) || password.length < merchantPasswordReplacementMinimum
        "
      >
        {{ t(submitting ? 'submitting' : 'changePassword') }}
      </Button>
    </form>
  </AccountPanel>
</template>
<style scoped src="../../components/account/account.css"></style>
