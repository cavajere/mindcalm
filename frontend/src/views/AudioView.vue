<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAudioStore } from '../stores/audioStore'
import AudioCard from '../components/AudioCard.vue'
import CategoryFilter from '../components/CategoryFilter.vue'
import TagFilter, { type FilterTag } from '../components/TagFilter.vue'
import SearchLoader from '../components/SearchLoader.vue'
import { useAdvancedSearch } from '../composables/useAdvancedSearch'

const store = useAudioStore()
const route = useRoute()
const router = useRouter()

const filteredAudio = ref<any[]>([])
const selectedCategory = ref('')
const selectedLevel = ref('')
const selectedDuration = ref('')
const selectedTags = ref<string[]>([])
const tags = ref<FilterTag[]>([])
const loading = ref(false)
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })

// Advanced search setup
const {
  searchQuery,
  isSearching,
  showSearchLoader,
  hasValidQuery
} = useAdvancedSearch({
  debounceMs: 400,
  minQueryLength: 2,
  onSearch: performSearch,
  onClear: loadAllAudio
})

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

function buildAudioSearchParams(query?: string) {
  const params = new URLSearchParams({
    page: String(pagination.value.page),
    limit: String(pagination.value.limit),
  })

  if (selectedCategory.value) params.set('category', selectedCategory.value)
  if (selectedLevel.value) params.set('level', selectedLevel.value)
  if (selectedDuration.value) params.set('duration', selectedDuration.value)
  if (selectedTags.value.length) params.set('tags', selectedTags.value.join(','))

  const trimmedQuery = query?.trim()
  if (trimmedQuery) {
    params.set('search', trimmedQuery)
    params.set('sort', 'relevance')
  }

  return params
}

async function fetchAudioResults(query?: string) {
  loading.value = true

  const params = buildAudioSearchParams(query)
  const queryString = params.toString()
  const logPayload = {
    query: query?.trim() || '',
    page: pagination.value.page,
    limit: pagination.value.limit,
    category: selectedCategory.value || null,
    level: selectedLevel.value || null,
    duration: selectedDuration.value || null,
    tags: [...selectedTags.value],
  }

  console.info('[Search][AudioView] request', logPayload)

  try {
    const { data } = await axios.get(`/api/audio?${queryString}`)
    filteredAudio.value = data.data
    pagination.value = data.pagination

    console.info('[Search][AudioView] response', {
      ...logPayload,
      resultCount: data.data.length,
      total: data.pagination?.total ?? data.data.length,
      totalPages: data.pagination?.totalPages ?? 1,
    })
  } catch (error) {
    console.error('[Search][AudioView] request failed', logPayload, error)
    throw error
  } finally {
    loading.value = false
  }
}

async function loadAllAudio() {
  await fetchAudioResults()
}

async function performSearch(query: string) {
  await fetchAudioResults(query)
}

function changePage(page: number) {
  pagination.value.page = page
  if (hasValidQuery.value) {
    void performSearch(searchQuery.value.trim())
    return
  }

  void loadAllAudio()
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
  await loadAllAudio()
})

watch([selectedCategory, selectedLevel, selectedDuration, selectedTags], () => {
  pagination.value.page = 1
  if (hasValidQuery.value) {
    void performSearch(searchQuery.value.trim())
  } else {
    void loadAllAudio()
  }
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
          v-model="searchQuery"
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

    <!-- Search loader -->
    <SearchLoader :visible="showSearchLoader" message="Ricerca audio..." />

    <!-- Loading -->
    <div v-if="loading && !isSearching" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 6" :key="i" class="card p-4 animate-pulse">
        <div class="aspect-video bg-gray-200 rounded-xl mb-4"></div>
        <div class="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
        <div class="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>

    <!-- Risultati -->
    <div v-else-if="filteredAudio.length && !isSearching" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <AudioCard v-for="audio in filteredAudio" :key="audio.id" :audio="audio" />
    </div>

    <!-- Vuoto -->
    <div v-else-if="!loading && !isSearching" class="text-center py-16">
      <p class="text-text-secondary text-lg">Nessun audio trovato</p>
      <p class="text-text-secondary text-sm mt-2">Prova a cambiare i filtri</p>
    </div>

    <!-- Paginazione -->
    <div v-if="pagination.totalPages > 1" class="mt-8 overflow-x-auto pb-2">
      <div class="flex w-full min-w-max justify-start gap-2 sm:justify-center">
        <button
          v-for="page in pagination.totalPages"
          :key="page"
          @click="changePage(page)"
          :class="[
            'h-10 min-w-10 rounded-lg px-3 text-sm font-medium transition-colors',
            page === pagination.page
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
