<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
}>(), {
  description: '',
})
</script>

<template>
  <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div class="min-w-0">
      <h1 class="text-2xl font-semibold tracking-tight text-text-primary sm:text-[1.75rem]">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
        {{ description }}
      </p>
    </div>

    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-3">
      <slot name="actions" />
    </div>
  </div>
</template>
