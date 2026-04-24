<template>
  <div class="app-form-table">
    <section v-if="title || description || $slots.headerActions" class="app-form-table__hero">
      <div v-if="title || description">
        <h2 v-if="title">{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
      </div>
      <div v-if="$slots.headerActions" class="app-form-table__hero-actions">
        <slot name="headerActions" />
      </div>
    </section>

    <section v-if="$slots.form" class="app-form-table__form">
      <slot name="form" />
    </section>

    <section class="app-form-table__table">
      <slot />
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<style scoped>
.app-form-table {
  display: grid;
  gap: 16px;
}

.app-form-table__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.app-form-table__hero h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.app-form-table__hero p {
  margin: 6px 0 0;
  color: var(--muted-foreground);
  font-size: 14px;
}

.app-form-table__hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.app-form-table__form,
.app-form-table__table {
  min-width: 0;
}

@media (max-width: 720px) {
  .app-form-table__hero {
    display: grid;
  }
}
</style>
