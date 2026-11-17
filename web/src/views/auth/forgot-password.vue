<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AccountPanel from '@/components/account/AccountPanel.vue'
import PasswordField from '@/components/account/PasswordField.vue'
import { merchantSession } from '@/auth/session'
import { merchantPasswordReplacementMinimum } from '@/auth/password-policy'
import { merchantAuthErrorKey } from '@/auth/user-message'
import { useAccountLocale, type AccountKey } from '@/i18n/account'
const { t } = useAccountLocale(),
  router = useRouter(),
  username = ref(''),
  code = ref(''),
  password = ref(''),
  sending = ref(false),
  submitting = ref(false),
  message = ref<AccountKey>(),
  hasError = ref(false)
async function requestCode() {
  if (sending.value || submitting.value) return
  sending.value = true
  message.value = undefined
  try {
    await merchantSession.requestPasswordReset(username.value)
    hasError.value = false
    message.value = 'resetRequested'
  } catch (e) {
    hasError.value = true
    message.value = merchantAuthErrorKey(e, 'codeFailed')
  } finally {
    sending.value = false
  }
}
async function resetPassword() {
  if (submitting.value || sending.value) return
  submitting.value = true
  message.value = undefined
  try {
    await merchantSession.resetPassword(username.value, code.value, password.value)
    password.value = ''
    code.value = ''
    await router.replace({ name: 'login', query: { notice: 'password-reset' } })
  } catch (e) {
    hasError.value = true
    message.value = merchantAuthErrorKey(e, 'resetFailed')
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <AccountPanel public-page :title="t('forgotTitle')" :description="t('forgotHint')">
    <form class="account-form" @submit.prevent="resetPassword">
      <fieldset :disabled="submitting || sending" class="grid min-w-0 gap-5">
        <label class="account-label">
          {{ t('username') }}
          <input
            v-model.trim="username"
            class="account-input"
            autocomplete="username"
            minlength="3"
            maxlength="64"
            required
          />
        </label>
        <div>
          <label for="reset-code" class="account-label">{{ t('code') }}</label>
          <div class="mt-2 flex min-w-0 gap-2">
            <input
              id="reset-code"
              v-model.trim="code"
              class="account-input grow"
              inputmode="numeric"
              autocomplete="one-time-code"
              pattern="[0-9]{6}"
              maxlength="6"
              required
            />
            <button
              class="account-action shrink-0"
              type="button"
              :disabled="sending || username.length < 3"
              @click="requestCode"
            >
              {{ t(sending ? 'sending' : 'sendCode') }}
            </button>
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
      <button
        class="account-action account-primary"
        type="submit"
        :disabled="
          submitting ||
          sending ||
          username.length < 3 ||
          !/^\d{6}$/.test(code) ||
          password.length < merchantPasswordReplacementMinimum
        "
      >
        {{ t(submitting ? 'submitting' : 'resetPassword') }}
      </button>
    </form>
    <RouterLink class="mt-5 inline-block text-sm font-medium text-primary" :to="{ name: 'login' }">
      {{ t('backLogin') }}
    </RouterLink>
  </AccountPanel>
</template>
<style scoped src="../../components/account/account.css"></style>
