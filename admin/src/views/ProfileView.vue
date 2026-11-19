<script setup lang="ts">
import { Button } from '@lingdian/console-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@lingdian/console-ui/card'
import { Input } from '@lingdian/console-ui/input'
import { notifications } from '../components/ui/notifications'
import { ref } from 'vue'
import { adminRequest } from '../auth/api-client'
import PageError from '../components/common/PageError.vue'
import PageHeader from '../components/common/PageHeader.vue'
const nickname = ref(''); const saving = ref(false); const error = ref('')
async function save() { if (saving.value) return; error.value = ''; saving.value = true; try { const result = await adminRequest<{ nickname: string }>('/auth/profile/nickname', { method: 'PATCH', body: JSON.stringify({ nickname: nickname.value }) }); nickname.value = result.nickname; notifications.success('昵称已更新') } catch (cause) { error.value = cause instanceof Error ? cause.message : '昵称更新失败' } finally { saving.value = false } }
</script>
<template>
  <div class="page-stack">
    <PageHeader title="个人设置" description="管理你的后台展示信息与偏好。" />
    <PageError v-if="error" :message="error" @retry="save" />
    <Card class="settings-card">
      <CardHeader>
        <CardTitle>基本信息</CardTitle>
        <p>昵称仅用于平台内展示，可随时修改。</p>
      </CardHeader>
      <CardContent>
        <form class="admin-form settings-form" @submit.prevent="save">
          <label for="admin-nickname">昵称</label>
          <Input id="admin-nickname" v-model="nickname" maxlength="32" placeholder="请输入昵称" :disabled="saving" />
          <span class="text-right text-xs text-muted-foreground">{{ nickname.length }}/32</span>
          <Button type="submit" class="justify-self-start" :disabled="saving">{{ saving ? '正在保存…' : '保存更改' }}</Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
