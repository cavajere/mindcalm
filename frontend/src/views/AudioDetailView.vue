<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAudioStore, type AudioDetail } from '../stores/audioStore'
import { usePlayerStore } from '../stores/playerStore'
import { useUiStore } from '../stores/uiStore'
import { trackAudioView } from '../services/analyticsService'

const route = useRoute()
const audioStore = useAudioStore()
const player = usePlayerStore()
const ui = useUiStore()

const audio = ref<AudioDetail | null>(null)
const relatedAudio = ref<any[]>([])
const loading = ref(true)
const playbackError = ref('')

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

async function playAudio() {
  if (!audio.value || !ui.isOnline) return

  playbackError.value = ''

  try {
    const playbackSession = await audioStore.createPlaybackSession(audio.value.id)

    player.play({
      id: audio.value.id,
      title: audio.value.title,
      playbackType: playbackSession.playbackType,
      playbackUrl: playbackSession.playbackUrl,
      coverImage: audio.value.coverImage,
      durationSec: audio.value.durationSec,
      streamExpiresAt: playbackSession.expiresAt,
    })
  } catch {
    playbackError.value = 'Impossibile avviare la riproduzione in questo momento.'
  }
}

const levelLabels: Record<string, string> = {
  BEGINNER: 'Principiante',
  INTERMEDIATE: 'Intermedio',
  ADVANCED: 'Avanzato',
}

onMounted(async () => {
  try {
    audio.value = await audioStore.fetchAudioById(route.params.id as string)
    await trackAudioView(audio.value.id)

    // Audio correlati
    const relatedParams: Record<string, string> = audio.value.tags[0]
      ? { tags: audio.value.tags[0].slug }
      : { category: audio.value.category.id }
    await audioStore.fetchAudio(relatedParams)
    relatedAudio.value = audioStore.audioItems
      .filter((item) => item.id !== audio.value!.id)
      .slice(0, 3)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-container">
    <!-- Loading -->
    <div v-if="loading" class="animate-pulse">
      <div class="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div class="h-4 bg-gray-200 rounded w-3/4 mb-8"></div>
      <div class="h-48 bg-gray-200 rounded-2xl"></div>
    </div>

    <template v-else-if="audio">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-2 text-sm text-text-secondary mb-6">
        <router-link to="/audio" class="hover:text-primary">Audio</router-link>
        <span>/</span>
        <span class="text-text-primary">{{ audio.title }}</span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main content -->
        <div class="lg:col-span-2">
          <!-- Cover -->
          <div v-if="audio.coverImage" class="aspect-video rounded-2xl overflow-hidden mb-6 bg-gray-100">
            <img :src="audio.coverImage" :alt="audio.title" class="w-full h-full object-cover" />
          </div>

          <h1 class="text-3xl font-bold text-text-primary mb-4">{{ audio.title }}</h1>

          <!-- Meta -->
          <div class="flex flex-wrap items-center gap-3 mb-6">
            <span
              class="badge"
              :style="{ backgroundColor: (audio.category.color || '#4A90D9') + '20', color: audio.category.color || '#4A90D9' }"
            >
              {{ audio.category.name }}
            </span>
            <span class="badge bg-gray-100 text-text-secondary">{{ levelLabels[audio.level] || audio.level }}</span>
            <span class="badge bg-primary/10 text-primary">
              {{ audio.streaming.delivery === 'hls' ? 'Streaming HLS protetto' : 'Streaming protetto' }}
            </span>
            <span class="text-sm text-text-secondary">{{ formatDuration(audio.durationSec) }}</span>
            <span class="text-sm text-text-secondary">{{ formatSize(audio.audioSize) }}</span>
          </div>

          <div v-if="audio.tags.length" class="mb-6 flex flex-wrap gap-2">
            <span
              v-for="tag in audio.tags"
              :key="tag.id"
              class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {{ tag.label }}
            </span>
          </div>

          <p class="text-text-secondary leading-relaxed mb-8">{{ audio.description }}</p>

          <!-- Actions -->
          <div class="flex flex-wrap gap-3">
            <button
              @click="playAudio"
              :disabled="!ui.isOnline"
              :class="[
                'btn-primary inline-flex items-center gap-2',
                !ui.isOnline ? 'cursor-not-allowed opacity-60' : '',
              ]"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
              </svg>
              Riproduci
            </button>
          </div>
          <p class="mt-4 text-sm text-text-secondary">
            L'ascolto avviene solo in streaming e richiede una connessione attiva.
          </p>
          <p v-if="playbackError" class="mt-2 text-sm text-red-600">
            {{ playbackError }}
          </p>
        </div>

        <!-- Sidebar: audio correlati -->
        <div>
          <h3 class="text-lg font-semibold text-text-primary mb-4">Audio correlati</h3>
          <div class="space-y-3">
            <router-link
              v-for="rel in relatedAudio"
              :key="rel.id"
              :to="`/audio/${rel.id}`"
              class="card p-3 flex items-center gap-3 hover:scale-[1.01] transition-transform"
            >
              <div
                class="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-sm"
                :style="{ backgroundColor: rel.category.color || '#4A90D9' }"
              >
                {{ formatDuration(rel.durationSec) }}
              </div>
              <div class="min-w-0">
                <p class="font-medium text-sm text-text-primary truncate">{{ rel.title }}</p>
                <p class="text-xs text-text-secondary">{{ levelLabels[rel.level] || rel.level }}</p>
              </div>
            </router-link>
            <p v-if="!relatedAudio.length" class="text-sm text-text-secondary">Nessun audio correlato</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
