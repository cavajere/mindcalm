<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  message: string
  variant?: 'success' | 'error' | 'info'
}>(), {
  variant: 'info',
})

const classes = computed(() => {
  if (props.variant === 'success') {
    return 'border border-green-200 bg-green-50 text-green-800'
  }

  if (props.variant === 'error') {
    return 'border border-red-200 bg-red-50 text-red-700'
  }

  return 'border border-sky-200 bg-sky-50 text-sky-700'
})
</script>

<template>
  <div class="rounded-lg px-4 py-3 text-sm" :class="classes">
    {{ message }}
  </div>
</template>
