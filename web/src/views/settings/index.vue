<script setup lang="ts">
import DataActionButton from '@/components/DataActionButton.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { IntegrationCapabilityContract, IntegrationProvider } from '@lingdian/contracts'
import { Badge } from '@lingdian/console-ui/badge'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { Switch } from '@lingdian/console-ui/switch'
import { merchantStore } from '@/auth/merchant-store'
import { listStoreIntegrations, setStoreIntegrationEnabled } from '@/services/integrations'
import { loadSingleStoreCapabilities, assertCapabilitiesForStore } from './settings-state'
import { useSettingsLocale, type SettingsKey } from './messages'
const { t, locale } = useSettingsLocale(),
  stores = computed(() => merchantStore.stores.value.filter((store) => store.id === merchantStore.selectedId.value)),
  store = computed(() => (stores.value.length === 1 ? stores.value[0] : undefined)),
  capabilities = ref<IntegrationCapabilityContract[]>([]),
  loading = ref(true),
  changing = ref<IntegrationProvider>(),
  error = ref<SettingsKey>(),
  notice = ref(false)
let sequence = 0,
  disposed = false
async function load() {
  const current = ++sequence
  loading.value = true
  error.value = undefined
  notice.value = false
  try {
    const result = await loadSingleStoreCapabilities(stores.value, listStoreIntegrations)
    if (current === sequence) capabilities.value = result.capabilities
  } catch (e) {
    if (current === sequence)
      error.value = e instanceof Error && e.message === 'settings.storeMismatch' ? 'storeMismatch' : 'failed'
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  () => merchantStore.selectedId.value,
  () => {
    sequence++
    capabilities.value = []
    void load()
  },
  { immediate: true },
)
async function toggle(item: IntegrationCapabilityContract) {
  if (changing.value || !store.value || !item.available || loading.value) return
  const id = store.value.id
  changing.value = item.provider
  error.value = undefined
  notice.value = false
  try {
    const updated = await setStoreIntegrationEnabled(id, item.provider, !item.enabled)
    if (disposed || id !== merchantStore.selectedId.value) return
    assertCapabilitiesForStore([updated], id)
    if (updated.provider !== item.provider) throw Error('settings.storeMismatch')
    capabilities.value = capabilities.value.map((row) => (row.provider === updated.provider ? updated : row))
    notice.value = true
  } catch (e) {
    if (!disposed)
      error.value = e instanceof Error && e.message === 'settings.storeMismatch' ? 'storeMismatch' : 'saveFailed'
  } finally {
    changing.value = undefined
  }
}
function reason(item: IntegrationCapabilityContract): SettingsKey {
  return item.reason_code === 'DEPLOYMENT_DISABLED'
    ? 'deploymentDisabled'
    : item.reason_code === 'NOT_CONFIGURED'
      ? 'notConfigured'
      : 'unavailable'
}
onBeforeUnmount(() => {
  disposed = true
  sequence++
})
</script>
<template>
  <section class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5" :lang="locale">
    <Card class="gap-0 p-5">
      <h2 class="font-semibold">{{ t('account') }}</h2>
      <div class="mt-4 flex flex-wrap gap-3">
        <Button as-child variant="outline">
          <RouterLink :to="{ name: 'profile-nickname' }">{{ t('nickname') }}</RouterLink>
        </Button>
        <Button as-child variant="outline">
          <RouterLink :to="{ name: 'change-password' }">{{ t('password') }}</RouterLink>
        </Button>
      </div>
    </Card>
    <Card class="min-w-0 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="font-semibold">{{ t('integrations') }}</h2>
          <p v-if="store" class="mt-1 break-words text-sm">{{ store.name }} · {{ store.code }}</p>
        </div>
        <DataActionButton action="refresh" :label="t('refresh')" :disabled="loading || !!changing || !store" @click="load" />
      </div>
      <p v-if="notice" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
      <div v-if="error" role="alert">
        <p class="text-sm text-destructive">{{ t(error) }}</p>
        <DataActionButton action="refresh" :label="t('refresh')" v-if="!changing" class="mt-3" @click="load" />
      </div>
      <p v-if="!store" role="status" class="text-sm text-muted-foreground">{{ t('noStore') }}</p>
      <p v-else-if="loading" role="status" class="py-5 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
      <div v-else-if="!error || error === 'saveFailed'" class="grid min-w-0 gap-3 lg:grid-cols-2">
        <p v-if="!capabilities.length" class="text-sm text-muted-foreground">{{ t('empty') }}</p>
        <Card v-for="item in capabilities" :key="item.provider" class="min-w-0 gap-3 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-medium">{{ t(item.provider) }}</h3>
            <Badge :variant="item.available && item.enabled ? 'secondary' : 'outline'">
              {{ t(!item.available ? 'notAvailable' : item.enabled ? 'enabled' : 'disabled') }}
            </Badge>
          </div>
          <p v-if="!item.available" class="text-sm text-muted-foreground">{{ t(reason(item)) }}</p>
          <label
            :for="'integration-' + item.provider"
            class="flex min-h-10 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm focus-within:border-ring"
            :class="item.available && !changing ? 'cursor-pointer hover:bg-accent' : 'opacity-60'"
          >
            <span>{{ t(changing === item.provider ? 'saving' : item.enabled ? 'enabled' : 'disabled') }}</span>
            <Switch
              :id="'integration-' + item.provider"
              :model-value="item.enabled"
              :aria-label="t(item.provider)"
              :disabled="!item.available || !!changing"
              @update:model-value="toggle(item)"
            />
          </label>
        </Card>
      </div>
    </Card>
  </section>
</template>
