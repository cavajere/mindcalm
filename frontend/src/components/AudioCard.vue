<script setup lang="ts">
import type { Audio } from '../stores/audioStore'

const props = defineProps<{ audio: Audio }>()

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  return `${m} min`
}

const levelLabels: Record<string, string> = {
  BEGINNER: 'Principiante',
  INTERMEDIATE: 'Intermedio',
  ADVANCED: 'Avanzato',
}
</script>

<template>
  <router-link :to="`/audio/${audio.id}`" class="card overflow-hidden hover:scale-[1.01] transition-transform">
    <!-- Cover / placeholder -->
    <div class="aspect-video relative">
      <img v-if="audio.coverImage" :src="audio.coverImage" :alt="audio.title" class="w-full h-full object-cover" />
      <div v-else class="w-full h-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
        <svg class="w-12 h-12 text-primary/30" fill="currentColor" viewBox="0 0 20 20">
          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/>
        </svg>
      </div>

      <!-- Duration badge -->
      <span class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
        {{ formatDuration(audio.durationSec) }}
      </span>
    </div>

    <div class="p-4">
      <div class="flex items-center gap-2 mb-2">
        <span
          class="badge text-xs"
          :style="{ backgroundColor: (audio.category.color || '#4A90D9') + '20', color: audio.category.color || '#4A90D9' }"
        >
          {{ audio.category.name }}
        </span>
        <span class="text-xs text-text-secondary">{{ levelLabels[audio.level] || audio.level }}</span>
      </div>
      <h3 class="font-semibold text-text-primary line-clamp-2">{{ audio.title }}</h3>
      <p class="text-sm text-text-secondary mt-1 line-clamp-2">{{ audio.description }}</p>
      <div v-if="audio.tags.length" class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="tag in audio.tags.slice(0, 3)"
          :key="tag.id"
          class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
        >
          {{ tag.label }}
        </span>
      </div>
    </div>
  </router-link>
</template>
