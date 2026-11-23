<script setup lang="ts">
import { ToastList } from '@lingdian/console-ui/toast'
import { notifications } from './components/ui/notifications'
</script>

<template>
  <RouterView />
  <ToastList :items="notifications.items.value" @dismiss="notifications.dismiss" />
</template>
