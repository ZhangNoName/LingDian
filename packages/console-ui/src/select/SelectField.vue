<script setup lang="ts" generic="Value extends string | number">
import { ref, useId, watch } from 'vue'
import Select from './Select.vue'
import SelectContent from './SelectContent.vue'
import SelectItem from './SelectItem.vue'
import SelectTrigger from './SelectTrigger.vue'
import SelectValue from './SelectValue.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  options: readonly { value: NoInfer<Value>; label: string; disabled?: boolean }[]
  disabled?: boolean
  required?: boolean
  placeholder?: string
  id?: string
}>()
const model = defineModel<Value>({ required: true })
const id = useId()
const invalid = ref(false)
watch(model, () => { invalid.value = false })

// Reka reserves the empty string for clearing the trigger. Keep it in the caller's model.
function itemValue(value: Value) {
  return value === '' ? null : value
}

function updateValue(value: unknown) {
  const option = props.options.find((option) => itemValue(option.value) === value)
  if (option && !option.disabled && option.value !== model.value) model.value = option.value
}

function focusInvalidTrigger(event: FocusEvent) {
  if (event.target instanceof HTMLSelectElement && !event.target.validity.valid) {
    document.getElementById(props.id ?? id)?.focus()
  }
}
</script>

<template>
  <span class="contents" @invalid.capture="invalid = true" @focusin="focusInvalidTrigger">
    <Select
      :model-value="itemValue(model)"
      :disabled="disabled"
      :required="required"
      :name="required ? id : undefined"
      @update:model-value="updateValue"
    >
      <SelectTrigger
        :id="props.id ?? id"
        :aria-invalid="invalid || undefined"
        class="w-auto min-w-0 max-w-full text-foreground"
        v-bind="$attrs"
      >
        <SelectValue :placeholder="placeholder" />
      </SelectTrigger>
      <SelectContent class="max-w-(--reka-select-content-available-width)">
        <SelectItem
          v-for="option in options"
          :key="JSON.stringify([option.value, option.label, option.disabled])"
          :value="itemValue(option.value)"
          :disabled="option.disabled"
          class="wrap-break-word"
        >
          {{ option.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </span>
</template>
