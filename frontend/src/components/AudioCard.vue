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
    <!-- Cover -->
    <div v-if="audio.coverImage" class="aspect-video relative">
      <img :src="audio.coverImage" :alt="audio.title" class="w-full h-full object-cover" />
      <span class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
        {{ formatDuration(audio.durationSec) }}
      </span>
    </div>

    <div class="p-4" :class="{ 'pt-5': !audio.coverImage }">
      <div class="flex items-center gap-2 mb-2">
        <span
          class="badge text-xs"
          :style="{ backgroundColor: (audio.category.color || '#4A90D9') + '20', color: audio.category.color || '#4A90D9' }"
        >
          {{ audio.category.name }}
        </span>
        <span v-if="audio.visibility === 'REGISTERED'" class="inline-flex items-center rounded-full bg-secondary/10 px-2 py-1 text-[10px] font-medium text-secondary">
          Premium
        </span>
        <span class="text-xs text-text-secondary">{{ levelLabels[audio.level] || audio.level }}</span>
        <span v-if="!audio.coverImage" class="text-xs text-text-secondary">· {{ formatDuration(audio.durationSec) }}</span>
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
