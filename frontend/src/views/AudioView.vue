<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAudioStore } from '../stores/audioStore'
import AudioCard from '../components/AudioCard.vue'
import CategoryFilter from '../components/CategoryFilter.vue'
import TagFilter, { type FilterTag } from '../components/TagFilter.vue'

const store = useAudioStore()
const route = useRoute()
const router = useRouter()

const search = ref('')
const selectedCategory = ref('')
const selectedLevel = ref('')
const selectedDuration = ref('')
const selectedTags = ref<string[]>([])
const tags = ref<FilterTag[]>([])

const levels = [
  { value: '', label: 'Tutti' },
  { value: 'BEGINNER', label: 'Principiante' },
  { value: 'INTERMEDIATE', label: 'Intermedio' },
  { value: 'ADVANCED', label: 'Avanzato' },
]

const durations = [
  { value: '', label: 'Tutte' },
  { value: 'short', label: 'Breve (< 10 min)' },
  { value: 'medium', label: 'Media (10-20 min)' },
  { value: 'long', label: 'Lunga (> 20 min)' },
]

function buildParams() {
  const params: Record<string, string> = {}
  if (search.value) params.search = search.value
  if (selectedCategory.value) params.category = selectedCategory.value
  if (selectedLevel.value) params.level = selectedLevel.value
  if (selectedDuration.value) params.duration = selectedDuration.value
  if (selectedTags.value.length) params.tags = selectedTags.value.join(',')
  return params
}

async function loadAudio() {
  await store.fetchAudio(buildParams())
}

function changePage(page: number) {
  store.pagination.page = page
  loadAudio()
}

onMounted(async () => {
  const [, { data: publicTags }] = await Promise.all([
    store.fetchCategories(),
    axios.get('/api/tags?contentType=audio'),
  ])
  tags.value = publicTags
  if (route.query.category) {
    selectedCategory.value = route.query.category as string
  }
  await loadAudio()
})

watch([selectedCategory, selectedLevel, selectedDuration, selectedTags], () => {
  store.pagination.page = 1
  loadAudio()
})

let searchTimeout: number
watch(search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    store.pagination.page = 1
    loadAudio()
  }, 400)
})
</script>

<template>
  <div class="page-container">
    <h1 class="text-3xl font-bold text-text-primary mb-8">Audio di mindfulness</h1>

    <!-- Filtri -->
    <div class="mb-8 space-y-4">
      <!-- Search -->
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Cerca audio..."
          class="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      <div class="flex flex-wrap items-start gap-3">
        <!-- Categorie -->
        <CategoryFilter
          v-if="store.categories.length"
          v-model="selectedCategory"
          :categories="store.categories"
        />

        <!-- Livello -->
        <div class="flex flex-wrap gap-1">
          <button
            v-for="l in levels"
            :key="l.value"
            @click="selectedLevel = l.value"
            :class="[
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              selectedLevel === l.value
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            ]"
          >
            {{ l.label }}
          </button>
        </div>

        <!-- Durata -->
        <select
          v-model="selectedDuration"
          class="w-full rounded-xl border border-gray-200 bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-auto"
        >
          <option v-for="d in durations" :key="d.value" :value="d.value">{{ d.label }}</option>
        </select>
      </div>

      <TagFilter
        v-if="tags.length"
        v-model="selectedTags"
        :tags="tags"
        label="Argomenti"
      />
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 6" :key="i" class="card p-4 animate-pulse">
        <div class="aspect-video bg-gray-200 rounded-xl mb-4"></div>
        <div class="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
        <div class="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>

    <!-- Risultati -->
    <div v-else-if="store.audioItems.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <AudioCard v-for="audio in store.audioItems" :key="audio.id" :audio="audio" />
    </div>

    <!-- Vuoto -->
    <div v-else class="text-center py-16">
      <p class="text-text-secondary text-lg">Nessun audio trovato</p>
      <p class="text-text-secondary text-sm mt-2">Prova a cambiare i filtri</p>
    </div>

    <!-- Paginazione -->
    <div v-if="store.pagination.totalPages > 1" class="mt-8 overflow-x-auto pb-2">
      <div class="flex w-full min-w-max justify-start gap-2 sm:justify-center">
        <button
          v-for="page in store.pagination.totalPages"
          :key="page"
          @click="changePage(page)"
          :class="[
            'h-10 min-w-10 rounded-lg px-3 text-sm font-medium transition-colors',
            page === store.pagination.page
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
          ]"
        >
          {{ page }}
        </button>
      </div>
    </div>
  </div>
</template>
