<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAudioStore } from '../stores/audioStore'
import AudioCard from '../components/AudioCard.vue'
import CategoryFilter from '../components/CategoryFilter.vue'
import TagFilter, { type FilterTag } from '../components/TagFilter.vue'
import SearchLoader from '../components/SearchLoader.vue'
import { useAdvancedSearch, SearchScorer } from '../composables/useAdvancedSearch'

const store = useAudioStore()
const route = useRoute()
const router = useRouter()

const allAudio = ref<any[]>([])
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
  hasValidQuery,
  isQueryEmpty
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

// Load all audio for client-side search and filtering
async function loadAllAudio() {
  loading.value = true
  
  try {
    const { data } = await axios.get('/api/audio?limit=1000')
    allAudio.value = data.data
    
    // Apply current filters
    applyFiltersAndPagination()
  } finally {
    loading.value = false
  }
}

// Perform client-side search with relevance scoring
async function performSearch(query: string) {
  if (!allAudio.value.length) {
    await loadAllAudio()
    return
  }
  
  // Score and sort audio by relevance
  const scoredAudio = allAudio.value
    .map(audio => ({
      audio,
      score: SearchScorer.scoreItem(audio, query, [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ])
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ audio }) => audio)
  
  // Apply filters
  const filtered = applyFilters(scoredAudio)
  
  // Update pagination and display
  updatePaginationAndDisplay(filtered)
}

// Apply all filters (category, level, duration, tags)
function applyFilters(audioList: any[]) {
  let filtered = audioList
  
  // Category filter
  if (selectedCategory.value) {
    filtered = filtered.filter(audio => audio.category?.id === selectedCategory.value)
  }
  
  // Level filter
  if (selectedLevel.value) {
    filtered = filtered.filter(audio => audio.level === selectedLevel.value)
  }
  
  // Duration filter
  if (selectedDuration.value) {
    const durationFilter = selectedDuration.value
    filtered = filtered.filter(audio => {
      const duration = audio.durationSeconds || 0
      switch (durationFilter) {
        case 'short':
          return duration < 600 // < 10 min
        case 'medium':
          return duration >= 600 && duration <= 1200 // 10-20 min
        case 'long':
          return duration > 1200 // > 20 min
        default:
          return true
      }
    })
  }
  
  // Tags filter
  if (selectedTags.value.length) {
    filtered = filtered.filter(audio =>
      selectedTags.value.some(tagId =>
        audio.tags?.some((tag: any) => tag.id === tagId)
      )
    )
  }
  
  return filtered
}

// Apply filters and pagination to current dataset
function applyFiltersAndPagination() {
  const filtered = applyFilters(allAudio.value)
  updatePaginationAndDisplay(filtered)
}

// Update pagination and display results
function updatePaginationAndDisplay(filtered: any[]) {
  // Update pagination
  pagination.value.total = filtered.length
  pagination.value.totalPages = Math.ceil(filtered.length / pagination.value.limit)
  
  // Apply pagination
  const startIndex = (pagination.value.page - 1) * pagination.value.limit
  const endIndex = startIndex + pagination.value.limit
  filteredAudio.value = filtered.slice(startIndex, endIndex)
}

function changePage(page: number) {
  pagination.value.page = page
  applyFiltersAndPagination()
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
    performSearch(searchQuery.value.trim())
  } else {
    applyFiltersAndPagination()
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
