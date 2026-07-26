<script setup lang="ts">defineProps<{ message: string }>(); defineEmits<{ retry: [] }>()</script>
<template><el-alert :title="message" type="error" show-icon :closable="false"><template #default><el-button link type="danger" @click="$emit('retry')">重试</el-button></template></el-alert></template>
