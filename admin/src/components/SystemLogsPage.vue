<script setup lang="ts">
import type { SystemLogLevel, SystemLogPage, SystemLogSource } from '@lingdian/contracts'
import { onMounted, ref } from 'vue'
import { getSystemLogs } from '../services/api'

const source = ref<SystemLogSource | ''>('')
const level = ref<SystemLogLevel | ''>('')
const page = ref<SystemLogPage>({ items: [], nextCursor: null })
const loading = ref(false)
const error = ref('')
const sourceLabels: Record<SystemLogSource, string> = { SERVER: '服务端', MINIAPP: '小程序', MERCHANT_WEB: '商家 Web', ADMIN_WEB: '后台 Web' }

async function load(cursor?: string) {
  loading.value = true
  error.value = ''
  try {
    const result = await getSystemLogs({ source: source.value || undefined, level: level.value || undefined, cursor })
    page.value = cursor ? { items: [...page.value.items, ...result.items], nextCursor: result.nextCursor } : result
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '日志加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <section class="logs-page">
    <div class="page-title"><div><h2>系统日志</h2><p>仅保留近 30 天的异常、生命周期和客户端错误记录。</p></div><button :disabled="loading" @click="load()">刷新</button></div>
    <div class="log-filters panel">
      <label>来源<select v-model="source" @change="load()"><option value="">全部</option><option v-for="(_, key) in sourceLabels" :key="key" :value="key">{{ sourceLabels[key as SystemLogSource] }}</option></select></label>
      <label>级别<select v-model="level" @change="load()"><option value="">全部</option><option value="INFO">INFO</option><option value="WARN">WARN</option><option value="ERROR">ERROR</option><option value="FATAL">FATAL</option></select></label>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="panel log-table">
      <p v-if="!loading && !page.items.length" class="hint">暂无符合条件的日志。</p>
      <article v-for="entry in page.items" :key="entry.id" class="log-row">
        <div><strong :data-level="entry.level">{{ entry.level }}</strong><span>{{ sourceLabels[entry.source] }}</span><time>{{ new Date(entry.createdAt).toLocaleString() }}</time></div>
        <code>{{ entry.event }}</code><p>{{ entry.message }}</p>
        <small v-if="entry.method || entry.path">{{ entry.method }} {{ entry.path }} {{ entry.statusCode ? `(${entry.statusCode})` : '' }}</small>
      </article>
      <button v-if="page.nextCursor" class="primary" :disabled="loading" @click="load(page.nextCursor)">加载更多</button>
    </div>
  </section>
</template>
