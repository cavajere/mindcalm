<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import ArticleCover from '../components/ArticleCover.vue'
import TagFilter, { type FilterTag } from '../components/TagFilter.vue'

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

const activeFiltersLabel = computed(() => {
  if (!selectedTags.value.length && !search.value.trim()) {
    return 'Nessun filtro attivo'
  }

  const parts = []
  if (search.value.trim()) {
    parts.push('ricerca attiva')
  }
  if (selectedTags.value.length) {
    parts.push(`${selectedTags.value.length} tag`)
  }

  return parts.join(' · ')
})

function formatArticleDate(value: string) {
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
  <div class="page-container space-y-8 pb-10">
    <section class="section-panel relative overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(74,144,217,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(80,184,96,0.12),_transparent_26%)]" />

      <div class="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-10">
        <div>
          <span class="eyebrow">Articoli pubblici</span>
          <h1 class="font-display mt-4 text-4xl font-semibold leading-none text-text-primary sm:text-5xl">
            Articoli e approfondimenti.
          </h1>
          <p class="mt-4 max-w-3xl text-base leading-8 text-text-secondary sm:text-lg">
            Cerca per parole chiave e trova i contenuti pubblici piu rilevanti tra temi, pratiche e approfondimenti.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
          <div class="surface-card-muted p-4">
            <p class="text-2xl font-semibold text-text-primary">{{ pagination.total }}</p>
            <p class="mt-1 text-sm text-text-secondary">articoli pubblicati</p>
          </div>
          <div class="surface-card-muted p-4">
            <p class="text-sm font-semibold text-text-primary">{{ activeFiltersLabel }}</p>
            <p class="mt-1 text-sm text-text-secondary">stato della ricerca</p>
          </div>
        </div>
      </div>
    </section>

    <section class="card p-5 sm:p-6">
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <label class="mb-2 block text-sm font-semibold text-text-primary">Cerca negli articoli</label>
          <div class="relative">
            <svg class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="search"
              type="text"
              placeholder="Cerca temi, pratiche e parole chiave..."
              class="w-full rounded-[22px] border border-ui-border bg-surface/92 py-3 pl-12 pr-4 transition-all"
            />
          </div>
        </div>

        <div>
          <TagFilter
            v-if="tags.length"
            v-model="selectedTags"
            :tags="tags"
            label="Filtra per tag"
          />
          <p v-else class="pt-8 text-sm text-text-secondary">I tag compariranno qui quando saranno disponibili.</p>
        </div>
      </div>
    </section>

    <div v-if="loading" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

    <div v-else-if="articles.length" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <router-link
        v-for="article in articles"
        :key="article.id"
        :to="`/articles/${article.slug}`"
        class="card group overflow-hidden"
      >
        <ArticleCover
          :src="article.coverImage"
          :alt="article.title"
          container-class="aspect-[4/3] overflow-hidden"
          image-class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div class="p-5">
          <div class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
            <span>{{ formatArticleDate(article.publishedAt) }}</span>
            <span>·</span>
            <span>{{ article.author }}</span>
          </div>

          <h2 class="mt-3 text-xl font-semibold leading-tight text-text-primary">
            {{ article.title }}
          </h2>

          <p class="mt-3 text-sm leading-7 text-text-secondary">
            {{ article.excerpt || 'Una lettura pubblica pensata per portare ordine, consapevolezza e strumenti pratici nella quotidianita.' }}
          </p>

          <div v-if="article.tags.length" class="mt-5 flex flex-wrap gap-2">
            <span
              v-for="tag in article.tags.slice(0, 3)"
              :key="tag.id"
              class="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"
            >
              {{ tag.label }}
            </span>
          </div>
        </div>
      </router-link>
    </div>

    <div v-else class="section-panel p-8 text-center sm:p-10">
      <div class="mx-auto max-w-2xl">
        <span class="eyebrow">Archivio vuoto</span>
        <h2 class="mt-5 text-2xl font-semibold text-text-primary sm:text-3xl">Nessun articolo corrisponde alla ricerca attuale.</h2>
        <p class="mt-4 text-base leading-8 text-text-secondary">
          Prova a rimuovere qualche filtro o torna piu tardi: i nuovi contenuti pubblici compariranno qui in automatico.
        </p>
        <router-link to="/" class="btn-secondary mt-6 inline-flex">Torna alla home</router-link>
      </div>
    </div>

    <div v-if="pagination.totalPages > 1" class="overflow-x-auto pb-2">
      <div class="flex w-full min-w-max justify-start gap-2 sm:justify-center">
        <button
          v-for="page in pagination.totalPages"
          :key="page"
          type="button"
          class="h-11 min-w-11 rounded-full px-4 text-sm font-semibold transition-colors"
          :class="page === pagination.page ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface text-text-secondary hover:bg-muted'"
          @click="changePage(page)"
        >
          {{ page }}
        </button>
      </div>
    </div>
  </div>
</template>
