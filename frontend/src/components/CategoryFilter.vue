<script setup lang="ts">
import type { Category } from '../stores/audioStore'

const props = defineProps<{
  categories: Category[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="flex gap-1 flex-wrap">
    <button
      @click="emit('update:modelValue', '')"
      :class="[
        'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
        !modelValue ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
      ]"
    >
      Tutte
    </button>
    <button
      v-for="cat in categories"
      :key="cat.id"
      @click="emit('update:modelValue', cat.id)"
      :class="[
        'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
        modelValue === cat.id
          ? 'text-white'
          : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
      ]"
      :style="modelValue === cat.id ? { backgroundColor: cat.color || '#4A90D9' } : {}"
    >
      {{ cat.name }}
    </button>
  </div>
</template>
