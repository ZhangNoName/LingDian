<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { adminRequest } from '../auth/api-client'
import PageError from '../components/common/PageError.vue'
import PageHeader from '../components/common/PageHeader.vue'
const nickname = ref(''); const saving = ref(false); const error = ref('')
async function save() { error.value = ''; saving.value = true; try { const result = await adminRequest<{ nickname: string }>('/auth/profile/nickname', { method: 'PATCH', body: JSON.stringify({ nickname: nickname.value }) }); nickname.value = result.nickname; ElMessage.success('昵称已更新') } catch (cause) { error.value = cause instanceof Error ? cause.message : '昵称更新失败' } finally { saving.value = false } }
</script>
<template><div class="page-stack"><PageHeader title="个人设置" description="管理你的后台展示信息与偏好。" /><PageError v-if="error" :message="error" @retry="save" /><el-card class="settings-card" shadow="never"><template #header><div><strong>基本信息</strong><p>昵称仅用于平台内展示，可随时修改。</p></div></template><el-form label-position="top" class="settings-form" @submit.prevent="save"><el-form-item label="昵称"><el-input v-model="nickname" maxlength="32" show-word-limit placeholder="请输入昵称" /></el-form-item><el-button type="primary" :loading="saving" @click="save">保存更改</el-button></el-form></el-card></div></template>
