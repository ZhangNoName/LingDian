<template>
  <div data-slot="list-toolbar" class="flex min-w-0 flex-wrap items-center justify-between gap-2">
    <div v-if="$slots.left" class="flex min-w-0 flex-wrap items-center gap-2">
      <slot name="left" />
    </div>
    <div class="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
      <slot />
    </div>
  </div>
</template>
