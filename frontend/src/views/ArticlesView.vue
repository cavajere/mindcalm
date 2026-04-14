<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import axios from 'axios'
import ArticleCover from '../components/ArticleCover.vue'
import TagFilter, { type FilterTag } from '../components/TagFilter.vue'
import { useRoute } from 'vue-router'

interface Article {
  id: string
  title: string
  slug: string
  excerpt: string | null
  author: string
  coverImage: string | null
  publishedAt: string
  tags: FilterTag[]
}

const articles = ref<Article[]>([])
const loading = ref(true)
const pagination = ref({ page: 1, limit: 12, total: 0, totalPages: 0 })
const search = ref('')
const tags = ref<FilterTag[]>([])
const selectedTags = ref<string[]>([])
const route = useRoute()

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

async function fetchArticles() {
  loading.value = true
  try {
    const query = new URLSearchParams({
      page: String(pagination.value.page),
      limit: String(pagination.value.limit),
    })
    if (search.value) query.set('search', search.value)
    if (selectedTags.value.length) query.set('tags', selectedTags.value.join(','))

    const { data } = await axios.get(`/api/articles?${query}`)
    articles.value = data.data
    pagination.value = { ...pagination.value, ...data.pagination }
  } finally {
    loading.value = false
  }
}

function changePage(page: number) {
  pagination.value.page = page
  fetchArticles()
}

onMounted(async () => {
  const { data } = await axios.get('/api/tags?contentType=article')
  tags.value = data
  parseTagsFromRoute()
  await fetchArticles()
})

watch(() => route.query.tags, () => {
  parseTagsFromRoute()
})

watch(selectedTags, () => {
  pagination.value.page = 1
  fetchArticles()
})

let searchTimeout: number
watch(search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    pagination.value.page = 1
    fetchArticles()
  }, 350)
})
</script>

<template>
  <div class="page-container">
    <h1 class="text-3xl font-bold text-text-primary mb-8">Articoli e guide</h1>

    <div class="mb-8 space-y-4">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Cerca articoli, temi e argomenti..."
          class="w-full rounded-xl border border-gray-200 bg-surface py-3 pl-10 pr-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <TagFilter
        v-if="tags.length"
        v-model="selectedTags"
        :tags="tags"
        label="Tag"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 6" :key="i" class="card animate-pulse">
        <div class="aspect-video bg-gray-200"></div>
        <div class="p-4">
          <div class="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
          <div class="h-3 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    </div>

    <!-- Articoli -->
    <div v-else-if="articles.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <router-link
        v-for="a in articles"
        :key="a.id"
        :to="`/articles/${a.slug}`"
        class="card overflow-hidden hover:scale-[1.01] transition-transform"
      >
        <ArticleCover
          :src="a.coverImage"
          :alt="a.title"
          container-class="aspect-video"
          image-class="h-full w-full object-cover"
        />
        <div class="p-5">
          <div class="flex items-center gap-2 text-xs text-text-secondary mb-2">
            <span>{{ a.author }}</span>
            <span>&middot;</span>
            <span>{{ new Date(a.publishedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) }}</span>
          </div>
          <h3 class="font-semibold text-text-primary mb-2 line-clamp-2">{{ a.title }}</h3>
          <p v-if="a.excerpt" class="text-sm text-text-secondary line-clamp-3">{{ a.excerpt }}</p>
          <div v-if="a.tags.length" class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="tag in a.tags.slice(0, 3)"
              :key="tag.id"
              class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
            >
              {{ tag.label }}
            </span>
          </div>
        </div>
      </router-link>
    </div>

    <div v-else class="text-center py-16">
      <p class="text-text-secondary text-lg">Nessun articolo pubblicato</p>
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
            page === pagination.page ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
          ]"
        >
          {{ page }}
        </button>
      </div>
    </div>
  </div>
</template>
