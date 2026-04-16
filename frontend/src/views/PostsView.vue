<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import ContentCover from '../components/ContentCover.vue'
import TagFilter, { type FilterTag } from '../components/TagFilter.vue'
import SearchLoader from '../components/SearchLoader.vue'
import { useAdvancedSearch } from '../composables/useAdvancedSearch'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  author: string
  coverImage: string | null
  publishedAt: string
  tags: FilterTag[]
}

const posts = ref<Post[]>([])
const loading = ref(true)
const pagination = ref({ page: 1, limit: 12, total: 0, totalPages: 0 })
const tags = ref<FilterTag[]>([])
const selectedTags = ref<string[]>([])
const route = useRoute()

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
  onClear: loadAllPosts
})

const hasActiveFilters = computed(() => selectedTags.value.length > 0 || hasValidQuery.value)

function formatPostDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function parseTagsFromRoute() {
  const raw = route.query.tags
  const value = Array.isArray(raw) ? raw.join(',') : raw
  if (!value) {
    selectedTags.value = []
    return
  }

  selectedTags.value = value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

function buildPostSearchParams(query?: string) {
  const params = new URLSearchParams({
    page: String(pagination.value.page),
    limit: String(pagination.value.limit),
  })

  if (selectedTags.value.length) params.set('tags', selectedTags.value.join(','))

  const trimmedQuery = query?.trim()
  if (trimmedQuery) {
    params.set('search', trimmedQuery)
    params.set('sort', 'relevance')
  }

  return params
}

async function fetchPosts(query?: string) {
  loading.value = true

  const params = buildPostSearchParams(query)
  const queryString = params.toString()
  const logPayload = {
    query: query?.trim() || '',
    page: pagination.value.page,
    limit: pagination.value.limit,
    tags: [...selectedTags.value],
  }

  console.info('[Search][PostsView] request', logPayload)

  try {
    const { data } = await axios.get(`/api/posts?${queryString}`)
    posts.value = data.data
    pagination.value = data.pagination

    console.info('[Search][PostsView] response', {
      ...logPayload,
      resultCount: data.data.length,
      total: data.pagination?.total ?? data.data.length,
      totalPages: data.pagination?.totalPages ?? 1,
    })
  } catch (error) {
    console.error('[Search][PostsView] request failed', logPayload, error)
    throw error
  } finally {
    loading.value = false
  }
}

async function loadAllPosts() {
  await fetchPosts()
}

async function performSearch(query: string) {
  await fetchPosts(query)
}

function changePage(page: number) {
  pagination.value.page = page
  if (hasValidQuery.value) {
    void performSearch(searchQuery.value.trim())
    return
  }

  void loadAllPosts()
}

onMounted(async () => {
  const { data } = await axios.get('/api/tags?contentType=post')
  tags.value = data
  parseTagsFromRoute()
  await loadAllPosts()
})

watch(() => route.query.tags, () => {
  parseTagsFromRoute()
})

watch(selectedTags, () => {
  pagination.value.page = 1
  if (hasValidQuery.value) {
    void performSearch(searchQuery.value.trim())
  } else {
    void loadAllPosts()
  }
})
</script>

<template>
  <div class="page-container">
    <h1 class="text-3xl font-bold text-text-primary mb-8">Post e articoli</h1>

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
          placeholder="Cerca post..."
          class="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      <TagFilter
        v-if="tags.length"
        v-model="selectedTags"
        :tags="tags"
        label="Argomenti"
      />
    </div>

    <!-- Search loader -->
    <SearchLoader :visible="showSearchLoader" message="Ricerca post..." />

    <div v-if="loading && !isSearching" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="item in 6" :key="item" class="card animate-pulse overflow-hidden">
        <div class="aspect-[4/3] skeleton-block"></div>
        <div class="space-y-3 p-5">
          <div class="skeleton-block h-3 w-24 rounded-full"></div>
          <div class="skeleton-block h-8 w-4/5 rounded-2xl"></div>
          <div class="skeleton-block h-4 w-full"></div>
          <div class="skeleton-block h-4 w-3/4"></div>
        </div>
      </div>
    </div>

    <div v-else-if="posts.length && !isSearching" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <router-link
        v-for="post in posts"
        :key="post.id"
        :to="`/posts/${post.slug}`"
        class="card group overflow-hidden"
      >
        <ContentCover
          v-if="post.coverImage"
          :src="post.coverImage"
          :alt="post.title"
          container-class="aspect-[4/3] overflow-hidden"
          image-class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div class="p-5" :class="{ 'pt-6': !post.coverImage }">
          <div class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
            <span>{{ formatPostDate(post.publishedAt) }}</span>
            <span>·</span>
            <span>{{ post.author }}</span>
          </div>

          <h2 class="mt-3 text-xl font-semibold leading-tight text-text-primary">
            {{ post.title }}
          </h2>

          <p class="mt-3 text-sm leading-7 text-text-secondary">
            {{ post.excerpt || 'Una lettura pubblica pensata per portare ordine, consapevolezza e strumenti pratici nella quotidianita.' }}
          </p>

          <div v-if="post.tags.length" class="mt-5 flex flex-wrap gap-2">
            <span
              v-for="tag in post.tags.slice(0, 3)"
              :key="tag.id"
              class="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"
            >
              {{ tag.label }}
            </span>
          </div>
        </div>
      </router-link>
    </div>

    <!-- Vuoto -->
    <div v-else-if="!loading && !isSearching" class="text-center py-16">
      <p class="text-text-secondary text-lg">Nessun post trovato</p>
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
