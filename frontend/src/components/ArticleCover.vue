<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string | null
    alt: string
    containerClass?: string
    imageClass?: string
    placeholderClass?: string
  }>(),
  {
    src: null,
    containerClass: '',
    imageClass: 'h-full w-full object-cover',
    placeholderClass: '',
  },
)

const hasImageError = ref(false)

const hasImage = computed(() => Boolean(props.src && props.src.trim().length > 0) && !hasImageError.value)

function handleError() {
  hasImageError.value = true
}

watch(
  () => props.src,
  () => {
    hasImageError.value = false
  },
)
</script>

<template>
  <div :class="containerClass">
    <img v-if="hasImage" :src="src ?? undefined" :alt="alt" :class="imageClass" @error="handleError" />

    <div
      v-else
      class="flex h-full w-full flex-col justify-between bg-gradient-to-br from-primary/12 via-background to-secondary/12 p-5"
      :class="placeholderClass"
      aria-hidden="true"
    >
      <div class="surface-card-muted flex h-11 w-11 items-center justify-center rounded-2xl text-primary shadow-sm">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-9-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary">MindCalm</p>
        <p class="mt-2 text-sm font-semibold text-text-primary">Immagine non disponibile</p>
      </div>
    </div>
  </div>
</template>
