<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { IconButton } from '@lingdian/console-ui/button'

defineOptions({ inheritAttrs: false })
defineProps<{ icon: Component; label: string; to?: RouteLocationRaw }>()
</script>

<template>
  <IconButton v-if="to" :icon="icon" :label="label" as-child v-bind="$attrs">
    <RouterLink :to="to"><component :is="icon" aria-hidden="true" /></RouterLink>
  </IconButton>
  <IconButton v-else :icon="icon" :label="label" v-bind="$attrs" />
</template>
