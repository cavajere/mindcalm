<script setup lang="ts">
defineProps<{ status: string }>()
</script>

<template>
  <span
    :class="[
      'text-xs px-2 py-1 rounded-full font-medium inline-block',
      status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
    ]"
  >
    {{ status === 'PUBLISHED' ? 'Pubblicato' : 'Bozza' }}
  </span>
</template>
