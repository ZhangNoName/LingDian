<script setup lang="ts">
import { Input } from '@lingdian/console-ui/input'
import { Button } from '@lingdian/console-ui/button'
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AccountPanel from '@/components/account/AccountPanel.vue'
import PasswordField from '@/components/account/PasswordField.vue'
import { merchantSession } from '@/auth/session'
import { merchantLoginPasswordMinimum } from '@/auth/password-policy'
import { safeInternalRedirect } from '@/auth/redirect'
import { merchantAuthErrorKey } from '@/auth/user-message'
import { useAccountLocale, type AccountKey } from '@/i18n/account'
const { t } = useAccountLocale(),
  router = useRouter(),
  route = useRoute(),
  username = ref(''),
  password = ref(''),
  loggingIn = ref(false),
  error = ref<AccountKey>()
const notice = computed<AccountKey | undefined>(() =>
  route.query.notice === 'password-reset'
    ? 'passwordReset'
    : route.query.notice === 'password-changed'
      ? 'passwordChanged'
      : route.query.notice === 'logout-unconfirmed'
        ? 'logoutFailed'
        : undefined,
)
async function login() {
  if (loggingIn.value) return
  loggingIn.value = true
  error.value = undefined
  try {
    await merchantSession.login(username.value, password.value)
    password.value = ''
    await router.replace(safeInternalRedirect(route.query.redirect))
  } catch (e) {
    error.value = merchantAuthErrorKey(e)
  } finally {
    loggingIn.value = false
  }
}
</script>
<template>
  <AccountPanel public-page :title="t('loginTitle')" :description="t('loginHint')">
    <form class="account-form" @submit.prevent="login">
      <fieldset :disabled="loggingIn" class="grid min-w-0 gap-5">
        <label class="account-label">
          {{ t('username') }}
          <Input
            v-model.trim="username"
            class="h-10"
            type="text"
            autocomplete="username"
            minlength="3"
            maxlength="64"
            :placeholder="t('usernamePlaceholder')"
            required
          />
        </label>
        <div>
          <PasswordField
            v-model="password"
            :label="t('password')"
            autocomplete="current-password"
            :minlength="merchantLoginPasswordMinimum"
            :disabled="loggingIn"
          />
        </div>
      </fieldset>
      <p
        v-if="error || notice"
        class="account-status"
        :class="error ? 'text-destructive' : 'text-emerald-700'"
        :role="error ? 'alert' : 'status'"
      >
        {{ t(error ?? notice!) }}
      </p>
      <Button
        size="lg" class="h-10"
        type="submit"
        :disabled="loggingIn || username.length < 3 || password.length < merchantLoginPasswordMinimum"
      >
        {{ t(loggingIn ? 'loggingIn' : 'login') }}
      </Button>
    </form>
    <RouterLink class="mt-5 inline-block text-sm font-medium text-primary" :to="{ name: 'forgot-password' }">
      {{ t('forgotLink') }}
    </RouterLink>
  </AccountPanel>
</template>
<style scoped src="../../components/account/account.css"></style>
