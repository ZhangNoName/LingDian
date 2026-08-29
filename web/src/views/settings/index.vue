<template>
  <div class="grid gap-5">
    <Card class="rounded-lg border-border/80">
      <CardHeader class="gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle class="text-xl">外部系统集成</CardTitle>
          <CardDescription class="mt-1 leading-6">
            收银、小票和外卖平台均默认关闭。部署端配置连接器后，仍需在这里为当前主门店启用。
          </CardDescription>
        </div>
        <div class="w-full rounded-lg border border-border bg-muted/30 px-4 py-3 md:w-80">
          <p class="text-xs font-medium text-muted-foreground">当前主门店（只读）</p>
          <p v-if="loadingStores" class="mt-1 text-sm text-muted-foreground">正在读取门店信息…</p>
          <template v-else-if="storeState.kind === 'ready'">
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <strong class="text-sm text-foreground">{{ storeState.store.name }}</strong>
              <Badge variant="outline">{{ storeStatusLabel(storeState.store.status) }}</Badge>
            </div>
            <code class="mt-1 block break-all text-xs text-muted-foreground">{{ storeState.store.code }}</code>
          </template>
          <p v-else-if="storeState.kind === 'empty'" class="mt-1 text-sm font-medium text-destructive">
            未配置主门店
          </p>
          <p v-else class="mt-1 text-sm font-medium text-destructive">
            配置异常：检测到 {{ storeState.storeCount }} 家门店
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <p v-if="errorMessage" class="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {{ errorMessage }}
        </p>
        <div v-if="loadingStores" class="py-10 text-center text-sm text-muted-foreground">正在加载主门店…</div>
        <div
          v-else-if="storeLoadFailed"
          class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          role="alert"
        >
          无法确认唯一主门店，集成功能已停止加载。
        </div>
        <div v-else-if="storeState.kind === 'empty'" class="py-10 text-center">
          <p class="font-medium text-foreground">尚未配置主门店</p>
          <p class="mt-2 text-sm text-muted-foreground">请联系平台管理员完成门店初始化和商家账号授权。</p>
        </div>
        <div
          v-else-if="storeState.kind === 'conflict'"
          class="rounded-lg border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900"
          role="alert"
        >
          <p class="font-medium">检测到 {{ storeState.storeCount }} 家可管理门店，集成功能已停止加载。</p>
          <p class="mt-2 leading-6">单店模式不会自动选择第一家门店，请联系平台管理员检查主门店配置和账号授权。</p>
        </div>
        <div v-else-if="loadingCapabilities" class="py-10 text-center text-sm text-muted-foreground">正在加载集成配置…</div>
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
        <p v-else class="py-10 text-center text-sm text-muted-foreground">当前主门店暂无可用的集成能力。</p>
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
import { computed, onMounted, ref } from 'vue'
import { Badge } from '@/baseComponents/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/baseComponents/card'
import { ElMessage, ElSwitch } from '@/components/ui/element-plus'
import {
  listMerchantStores,
  listStoreIntegrations,
  setStoreIntegrationEnabled,
  type MerchantStoreSummary,
} from '@/services/integrations'
import { getStoreStatusPresentation, resolveSingleStoreView } from '@/views/stores/store-view'
import { loadSingleStoreCapabilities } from './settings-state'

const stores = ref<MerchantStoreSummary[]>([])
const capabilities = ref<IntegrationCapabilityContract[]>([])
const loadingStores = ref(false)
const loadingCapabilities = ref(false)
const changingProvider = ref<IntegrationProvider | null>(null)
const errorMessage = ref('')
const storeLoadFailed = ref(false)
const storeState = computed(() => resolveSingleStoreView(stores.value))

onMounted(async () => {
  loadingStores.value = true
  storeLoadFailed.value = false
  errorMessage.value = ''
  try {
    stores.value = await listMerchantStores()
  } catch (error) {
    storeLoadFailed.value = true
    errorMessage.value = toMessage(error)
  } finally {
    loadingStores.value = false
  }

  if (!storeLoadFailed.value) await loadCapabilities()
})

async function loadCapabilities() {
  loadingCapabilities.value = true
  errorMessage.value = ''
  try {
    const result = await loadSingleStoreCapabilities(stores.value, listStoreIntegrations)
    capabilities.value = result.capabilities
  } catch (error) {
    errorMessage.value = toMessage(error)
  } finally {
    loadingCapabilities.value = false
  }
}

async function changeEnabled(item: IntegrationCapabilityContract, enabled: boolean) {
  if (storeState.value.kind !== 'ready') {
    errorMessage.value = '无法确认唯一主门店，未修改集成配置。'
    return
  }

  changingProvider.value = item.provider
  errorMessage.value = ''
  try {
    const updated = await setStoreIntegrationEnabled(storeState.value.store.id, item.provider, enabled)
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

function storeStatusLabel(status: MerchantStoreSummary['status']): string {
  return getStoreStatusPresentation(status).label
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : '集成配置加载失败，请稍后重试。'
}
</script>
