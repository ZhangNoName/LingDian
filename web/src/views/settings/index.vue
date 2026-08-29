<template>
  <div class="grid gap-5">
    <Card class="rounded-lg border-border/80">
      <CardHeader class="gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle class="text-xl">外部系统集成</CardTitle>
          <CardDescription class="mt-1 leading-6">
            收银、小票和外卖平台均默认关闭。部署端配置连接器后，仍需在这里按门店启用。
          </CardDescription>
        </div>
        <ElSelect
          v-model="selectedStoreId"
          class="w-full md:w-72"
          placeholder="选择门店"
          :disabled="loadingStores"
          @change="loadCapabilities"
        >
          <ElOption
            v-for="store in stores"
            :key="store.id"
            :label="`${store.name}（${store.code}）`"
            :value="store.id"
          />
        </ElSelect>
      </CardHeader>
      <CardContent>
        <p v-if="errorMessage" class="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {{ errorMessage }}
        </p>
        <div v-if="loadingCapabilities" class="py-10 text-center text-sm text-muted-foreground">正在加载集成配置…</div>
        <div v-else-if="capabilities.length" class="grid gap-3 md:grid-cols-2">
          <section
            v-for="item in capabilities"
            :key="item.provider"
            class="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-medium text-foreground">{{ item.display_name }}</h3>
                <Badge variant="outline">{{ categoryLabel(item.category) }}</Badge>
                <Badge v-if="!item.available" variant="secondary">未配置</Badge>
              </div>
              <p class="mt-2 text-sm leading-6 text-muted-foreground">
                {{ item.reason ?? providerDescription(item.provider) }}
              </p>
              <code class="mt-2 block text-xs text-muted-foreground">{{ item.provider }}</code>
            </div>
            <ElSwitch
              :model-value="item.enabled"
              :disabled="!item.available || changingProvider === item.provider"
              :loading="changingProvider === item.provider"
              @change="(value) => changeEnabled(item, Boolean(value))"
            />
          </section>
        </div>
        <p v-else class="py-10 text-center text-sm text-muted-foreground">当前账号没有可管理的门店。</p>
      </CardContent>
    </Card>

    <Card class="rounded-lg border-border/80">
      <CardHeader>
        <CardTitle class="text-base">接入边界</CardTitle>
        <CardDescription class="mt-1 leading-6">
          平台密钥、证书和官方 SDK 保留在独立连接器中；订单服务只投递带版本号和签名的标准事件。
          连接器异常会自动重试，不会阻塞顾客下单。
        </CardDescription>
      </CardHeader>
    </Card>
  </div>
</template>

<script setup lang="ts">
import type { IntegrationCapabilityContract, IntegrationProvider } from '@lingdian/contracts'
import { onMounted, ref } from 'vue'
import { Badge } from '@/baseComponents/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/baseComponents/card'
import { ElMessage, ElOption, ElSelect, ElSwitch } from '@/components/ui/element-plus'
import {
  listMerchantStores,
  listStoreIntegrations,
  setStoreIntegrationEnabled,
  type MerchantStoreSummary,
} from '@/services/integrations'

const stores = ref<MerchantStoreSummary[]>([])
const capabilities = ref<IntegrationCapabilityContract[]>([])
const selectedStoreId = ref('')
const loadingStores = ref(false)
const loadingCapabilities = ref(false)
const changingProvider = ref<IntegrationProvider | null>(null)
const errorMessage = ref('')

onMounted(async () => {
  loadingStores.value = true
  try {
    stores.value = await listMerchantStores()
    selectedStoreId.value = stores.value[0]?.id ?? ''
    await loadCapabilities()
  } catch (error) {
    errorMessage.value = toMessage(error)
  } finally {
    loadingStores.value = false
  }
})

async function loadCapabilities() {
  if (!selectedStoreId.value) {
    capabilities.value = []
    return
  }
  loadingCapabilities.value = true
  errorMessage.value = ''
  try {
    capabilities.value = await listStoreIntegrations(selectedStoreId.value)
  } catch (error) {
    errorMessage.value = toMessage(error)
  } finally {
    loadingCapabilities.value = false
  }
}

async function changeEnabled(item: IntegrationCapabilityContract, enabled: boolean) {
  changingProvider.value = item.provider
  errorMessage.value = ''
  try {
    const updated = await setStoreIntegrationEnabled(selectedStoreId.value, item.provider, enabled)
    capabilities.value = capabilities.value.map((candidate) =>
      candidate.provider === updated.provider ? updated : candidate,
    )
    ElMessage.success(enabled ? '集成已启用' : '集成已停用')
  } catch (error) {
    errorMessage.value = toMessage(error)
  } finally {
    changingProvider.value = null
  }
}

function categoryLabel(category: IntegrationCapabilityContract['category']): string {
  return { CASHIER: '收银', PRINTING: '打印', DELIVERY: '外卖' }[category]
}

function providerDescription(provider: IntegrationProvider): string {
  return {
    CASHIER: '订单创建后同步到门店 POS 或 ERP 连接器。',
    RECEIPT_PRINTER: '将标准小票任务发送到门店本地打印网关。',
    MEITUAN_WAIMAI: '由美团连接器负责官方协议、签名和平台状态映射。',
    JD_DAOJIA: '由京东到家连接器负责官方协议、签名和平台状态映射。',
  }[provider]
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : '集成配置加载失败，请稍后重试。'
}
</script>
