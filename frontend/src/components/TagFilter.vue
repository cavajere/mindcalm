<script setup lang="ts">
import { computed } from 'vue'

export interface FilterTag {
  id: string
  label: string
  slug: string
}

const props = defineProps<{
  tags: FilterTag[]
  modelValue: string[]
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const selected = computed(() => new Set(props.modelValue))

function toggleTag(slug: string) {
  const next = new Set(props.modelValue)
  if (next.has(slug)) next.delete(slug)
  else next.add(slug)

  emit('update:modelValue', [...next])
}

function clear() {
  emit('update:modelValue', [])
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-medium text-text-primary">{{ label || 'Tag' }}</p>
      <button
        v-if="modelValue.length"
        type="button"
        class="text-xs font-medium text-primary hover:text-primary-dark"
        @click="clear"
      >
        Azzera
      </button>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="tag in tags"
        :key="tag.id"
        type="button"
        @click="toggleTag(tag.slug)"
        :class="[
          'rounded-full border px-3 py-1.5 text-sm transition-colors',
          selected.has(tag.slug)
            ? 'border-primary bg-primary text-white'
            : 'border-gray-200 bg-white text-text-secondary hover:border-primary/30 hover:text-text-primary'
        ]"
      >
        {{ tag.label }}
      </button>
    </div>
  </div>
</template>
