<script setup lang="ts">
import type { MerchantSummary } from '@lingdian/contracts'
import { computed, onMounted, reactive, ref } from 'vue'
import { adminRequest } from '../auth/api-client'

type Store = { id: string; name: string }

const merchants = ref<MerchantSummary[]>([])
const stores = ref<Store[]>([])
const message = ref('')
const loading = ref(false)
const creating = ref(false)
const form = reactive({ username: '', phone: '', password: '', storeIds: [] as string[] })
const storeScopeDrafts = ref<Record<string, string[]>>({})
const canCreate = computed(() => form.username.trim() && form.phone.trim() && form.password.length >= 12 && form.storeIds.length > 0)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const [merchantList, currentStore] = await Promise.all([
      adminRequest<MerchantSummary[]>('/admin/merchants'),
      adminRequest<Store>('/stores/current'),
    ])
    merchants.value = merchantList
    const knownStores = new Map<string, Store>([[currentStore.id, currentStore]])
    merchantList.flatMap((merchant) => merchant.storeIds).forEach((id) => {
      if (!knownStores.has(id)) knownStores.set(id, { id, name: `门店 ${id}` })
    })
    stores.value = [...knownStores.values()]
    storeScopeDrafts.value = Object.fromEntries(merchantList.map((merchant) => [merchant.userId, [...merchant.storeIds]]))
  } catch (cause) {
    message.value = cause instanceof Error ? cause.message : '商家数据加载失败'
  } finally {
    loading.value = false
  }
}

async function createMerchant() {
  if (!canCreate.value) return
  creating.value = true
  message.value = ''
  try {
    await adminRequest<MerchantSummary>('/admin/merchants', {
      method: 'POST',
      body: JSON.stringify({ ...form, username: form.username.trim(), phone: form.phone.trim() }),
    })
    form.username = ''
    form.phone = ''
    form.password = ''
    form.storeIds = []
    await load()
    message.value = '商家账号已创建'
  } catch (cause) {
    message.value = cause instanceof Error ? cause.message : '商家账号创建失败'
  } finally {
    creating.value = false
  }
}

async function updateMerchant(merchant: MerchantSummary, enabled: boolean, storeIds = merchant.storeIds) {
  if (storeIds.length === 0) {
    message.value = '每个商家至少需要选择一个门店'
    return
  }
  message.value = ''
  try {
    const updated = await adminRequest<MerchantSummary>(`/admin/merchants/${merchant.userId}`, {
      method: 'PATCH', body: JSON.stringify({ enabled, storeIds }),
    })
    merchants.value = merchants.value.map((item) => item.userId === updated.userId ? updated : item)
    message.value = '商家账号已更新'
  } catch (cause) {
    message.value = cause instanceof Error ? cause.message : '商家账号更新失败'
  }
}

function saveStoreScope(merchant: MerchantSummary) {
  void updateMerchant(merchant, merchant.status === 'ACTIVE', storeScopeDrafts.value[merchant.userId] ?? [])
}

onMounted(() => { void load() })
</script>

<template>
  <section class="merchant-page">
    <div class="page-title"><div><h2>商家账号管理</h2><p>仅超级管理员可创建、停用和调整门店范围。</p></div><button @click="load" :disabled="loading">刷新</button></div>
    <p v-if="message" class="notice">{{ message }}</p>
    <form class="panel merchant-form" @submit.prevent="createMerchant">
      <h3>创建商家账号</h3>
      <label>账号<input v-model.trim="form.username" pattern="[a-z0-9._-]{3,64}" required placeholder="3–64 位小写账号" /></label>
      <label>手机号<input v-model.trim="form.phone" required placeholder="用于密码验证" /></label>
      <label>初始密码<input v-model="form.password" type="password" minlength="12" required autocomplete="new-password" /></label>
      <fieldset><legend>允许门店（至少选择一个）</legend><label v-for="store in stores" :key="store.id" class="check"><input v-model="form.storeIds" type="checkbox" :value="store.id" />{{ store.name }}（{{ store.id }}）</label></fieldset>
      <button class="primary" type="submit" :disabled="!canCreate || creating">{{ creating ? '创建中…' : '创建商家' }}</button>
    </form>
    <section class="panel"><h3>已有商家</h3><p v-if="loading">加载中…</p><div v-for="merchant in merchants" :key="merchant.userId" class="merchant-row"><div><strong>{{ merchant.username }}</strong><span>{{ merchant.phone }}</span><fieldset><legend>允许门店</legend><label v-for="store in stores" :key="store.id" class="check"><input v-model="storeScopeDrafts[merchant.userId]" type="checkbox" :value="store.id" />{{ store.name }}（{{ store.id }}）</label></fieldset><button :disabled="(storeScopeDrafts[merchant.userId] ?? []).length === 0" @click="saveStoreScope(merchant)">保存门店范围</button></div><label class="check"><input :checked="merchant.status === 'ACTIVE'" type="checkbox" @change="updateMerchant(merchant, ($event.target as HTMLInputElement).checked, storeScopeDrafts[merchant.userId] ?? [])" />启用</label></div><p v-if="!loading && merchants.length === 0">暂无商家账号。</p></section>
  </section>
</template>
