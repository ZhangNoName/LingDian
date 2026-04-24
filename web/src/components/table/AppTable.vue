<template>
  <section class="app-table">
    <header v-if="title || description || $slots.headerActions" class="app-table__header">
      <div v-if="title || description">
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="description">{{ description }}</p>
      </div>
      <div v-if="$slots.headerActions" class="app-table__header-actions">
        <slot name="headerActions" />
      </div>
    </header>

    <div v-if="$slots.toolbar" class="app-table__toolbar">
      <slot name="toolbar" />
    </div>

    <div class="app-table__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<style scoped>
.app-table {
  display: grid;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
}

.app-table__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.app-table__header h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.app-table__header p {
  margin: 6px 0 0;
  color: var(--muted-foreground);
  font-size: 14px;
}

.app-table__header-actions,
.app-table__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.app-table__header-actions {
  justify-content: flex-end;
}

.app-table__body {
  min-width: 0;
}

@media (max-width: 720px) {
  .app-table__header {
    display: grid;
  }
}
</style>
