<script setup lang="ts">
import { ref } from 'vue'
import { adminRequest } from '../auth/api-client'

const nickname = ref('')
const message = ref('')
const saving = ref(false)

async function save() {
  message.value = ''
  saving.value = true
  try {
    const result = await adminRequest<{ nickname: string }>('/auth/profile/nickname', {
      method: 'PATCH', body: JSON.stringify({ nickname: nickname.value }),
    })
    nickname.value = result.nickname
    message.value = '昵称已更新'
  } catch (cause) {
    message.value = cause instanceof Error ? cause.message : '昵称更新失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="panel profile-page">
    <h2>我的昵称</h2>
    <p>昵称仅用于展示，可与其他用户重复。</p>
    <form class="inline-form" @submit.prevent="save">
      <input v-model="nickname" maxlength="32" required placeholder="输入 1–32 个字符" />
      <button class="primary" :disabled="saving" type="submit">{{ saving ? '保存中…' : '保存昵称' }}</button>
    </form>
    <p v-if="message" class="notice">{{ message }}</p>
  </section>
</template>
