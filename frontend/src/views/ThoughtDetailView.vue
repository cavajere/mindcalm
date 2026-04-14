<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import RichTextRenderer from '../components/RichTextRenderer.vue'
import ContentCover from '../components/ContentCover.vue'
import { trackThoughtView } from '../services/analyticsService'

interface Thought {
  id: string
  slug: string
  title: string
  body: string
  excerpt: string | null
  author: string
  coverImage: string | null
  publishedAt: string
  tags: Array<{ id: string; label: string; slug: string }>
}

const route = useRoute()
const article = ref<Thought | null>(null)
const loading = ref(true)

const formattedDate = computed(() => {
  if (!article.value) return ''

  return new Date(article.value.publishedAt).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const readingTime = computed(() => {
  if (!article.value) return 0

  const plainText = article.value.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = plainText ? plainText.split(' ').length : 0

  return Math.max(1, Math.ceil(wordCount / 220))
})

const authorInitials = computed(() => {
  if (!article.value?.author) return 'MC'

  return article.value.author
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
})

async function loadArticle(slug: string) {
  loading.value = true
  article.value = null

  try {
    const { data } = await axios.get(`/api/thoughts/${slug}`)
    article.value = data
    await trackThoughtView(data.id)
  } catch {
    article.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.slug,
  (slug) => {
    if (typeof slug === 'string' && slug) {
      loadArticle(slug)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="page-container">
    <div v-if="loading" class="mx-auto max-w-5xl animate-pulse">
      <div class="skeleton-block mb-4 h-10 w-40 rounded-2xl"></div>

      <div class="surface-card overflow-hidden p-6 sm:p-8 lg:p-10">
        <div class="mb-4 flex gap-3">
          <div class="skeleton-block h-8 w-24 rounded-full"></div>
          <div class="skeleton-block h-8 w-40 rounded-full"></div>
        </div>
        <div class="skeleton-block h-12 w-4/5 rounded-2xl"></div>
        <div class="skeleton-block mt-4 h-6 w-3/5 rounded-xl"></div>
        <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div class="space-y-3">
            <div class="skeleton-block h-4 w-full"></div>
            <div class="skeleton-block h-4 w-5/6"></div>
            <div class="skeleton-block h-4 w-2/3"></div>
          </div>
          <div class="skeleton-block aspect-[4/3] rounded-[28px]"></div>
        </div>
      </div>

      <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div class="surface-card-muted p-8">
          <div class="space-y-4">
            <div class="skeleton-block h-4 w-full"></div>
            <div class="skeleton-block h-4 w-full"></div>
            <div class="skeleton-block h-4 w-5/6"></div>
            <div class="skeleton-block h-4 w-full"></div>
            <div class="skeleton-block h-4 w-4/6"></div>
          </div>
        </div>
        <div class="surface-card-muted hidden lg:block"></div>
      </div>
    </div>

    <article v-else-if="article" class="mx-auto max-w-5xl">
      <div class="mb-5">
        <router-link
          to="/thoughts"
          class="btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 19l-7-7 7-7" />
          </svg>
          Tutti i pensieri
        </router-link>
      </div>

      <header class="section-panel relative overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(74,144,217,0.12),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(80,184,96,0.12),_transparent_28%)]" />

        <div class="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:p-10">
          <div class="min-w-0">
            <div class="mb-5 flex flex-wrap items-center gap-2">
              <span class="badge surface-pill text-primary">Pensiero</span>
              <span class="badge surface-pill text-text-secondary">{{ formattedDate }}</span>
              <span class="badge surface-pill text-text-secondary">{{ readingTime }} min di lettura</span>
            </div>

            <h1 class="max-w-3xl text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
              {{ article.title }}
            </h1>

            <p v-if="article.excerpt" class="mt-5 max-w-2xl text-base leading-8 text-text-secondary sm:text-lg">
              {{ article.excerpt }}
            </p>

            <div class="mt-8 flex flex-wrap items-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-text-primary text-sm font-semibold text-background">
                {{ authorInitials }}
              </div>
              <div>
                <p class="text-sm font-semibold text-text-primary">{{ article.author }}</p>
                <p class="text-sm text-text-secondary">Pensiero pubblicato il {{ formattedDate }}</p>
              </div>
            </div>

            <div v-if="article.tags.length" class="mt-6 flex flex-wrap gap-2">
              <span
                v-for="tag in article.tags"
                :key="tag.id"
                class="surface-pill px-3 py-1 text-xs font-medium text-text-secondary"
              >
                {{ tag.label }}
              </span>
            </div>
          </div>

          <ContentCover
            :src="article.coverImage"
            :alt="article.title"
            container-class="surface-card min-h-[280px] overflow-hidden"
            image-class="aspect-[4/3] h-full w-full object-cover"
            placeholder-class="min-h-[280px]"
          />
        </div>
      </header>

      <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div class="min-w-0">
          <div class="surface-card p-6 sm:p-8 lg:p-10">
            <RichTextRenderer :html="article.body" />
          </div>
        </div>

        <aside class="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div class="surface-card-muted p-6">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">In breve</p>
            <div class="mt-5 space-y-4">
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Autore</p>
                <p class="mt-1 text-sm font-medium text-text-primary">{{ article.author }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Pubblicazione</p>
                <p class="mt-1 text-sm font-medium text-text-primary">{{ formattedDate }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Tempo di lettura</p>
                <p class="mt-1 text-sm font-medium text-text-primary">{{ readingTime }} minuti</p>
              </div>
            </div>
          </div>

          <div class="rounded-[28px] border border-primary/10 bg-primary/5 p-6">
            <p class="text-sm font-semibold text-text-primary">Continua la lettura</p>
            <p class="mt-2 text-sm leading-7 text-text-secondary">
              Se vuoi approfondire altri temi, torna all’archivio e scegli un nuovo pensiero.
            </p>
            <router-link to="/thoughts" class="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark">
              Vai ai pensieri
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5l7 7-7 7" />
              </svg>
            </router-link>
          </div>
        </aside>
      </div>
    </article>

    <div v-else class="mx-auto max-w-2xl py-16 text-center">
      <div class="surface-card px-6 py-10">
        <div class="surface-card-muted mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-text-secondary">
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9.172 9.172a4 4 0 115.656 5.656M9 13h.01M15 11h.01M12 6h.01M12 18h.01M6 12h.01M18 12h.01" />
          </svg>
        </div>
        <h2 class="mt-5 text-2xl font-semibold text-text-primary">Pensiero non disponibile</h2>
        <p class="mt-3 text-base leading-7 text-text-secondary">
          Il contenuto potrebbe essere stato rimosso oppure il link non è corretto.
        </p>
        <router-link to="/thoughts" class="btn-primary mt-6 inline-flex items-center gap-2">
          Torna ai pensieri
        </router-link>
      </div>
    </div>
  </div>
</template>
