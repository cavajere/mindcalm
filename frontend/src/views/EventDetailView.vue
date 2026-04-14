<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import ArticleCover from '../components/ArticleCover.vue'
import ArticleRenderer from '../components/ArticleRenderer.vue'

interface EventItem {
  id: string
  slug: string
  title: string
  body: string
  excerpt: string | null
  organizer: string
  city: string
  venue: string | null
  startsAt: string
  endsAt: string | null
  coverImage: string | null
}

const route = useRoute()
const eventItem = ref<EventItem | null>(null)
const loading = ref(true)

const formattedDate = computed(() => {
  if (!eventItem.value) return ''

  return new Date(eventItem.value.startsAt).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const formattedTime = computed(() => {
  if (!eventItem.value) return ''

  const start = new Date(eventItem.value.startsAt)
  const startLabel = start.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (!eventItem.value.endsAt) {
    return startLabel
  }

  const endLabel = new Date(eventItem.value.endsAt).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${startLabel} - ${endLabel}`
})

const locationLabel = computed(() => {
  if (!eventItem.value) return ''

  return eventItem.value.venue
    ? `${eventItem.value.city} · ${eventItem.value.venue}`
    : eventItem.value.city
})

async function loadEvent(slug: string) {
  loading.value = true
  eventItem.value = null

  try {
    const { data } = await axios.get(`/api/events/${slug}`)
    eventItem.value = data
  } catch {
    eventItem.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.slug,
  (slug) => {
    if (typeof slug === 'string' && slug) {
      loadEvent(slug)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="page-container pb-10">
    <div v-if="loading" class="mx-auto max-w-5xl animate-pulse">
      <div class="mb-4 h-10 w-40 rounded-2xl bg-slate-200"></div>

      <div class="overflow-hidden rounded-[32px] border border-gray-100 bg-white p-6 sm:p-8 lg:p-10">
        <div class="mb-4 flex gap-3">
          <div class="h-8 w-24 rounded-full bg-slate-200"></div>
          <div class="h-8 w-40 rounded-full bg-slate-200"></div>
        </div>
        <div class="h-12 w-4/5 rounded-2xl bg-slate-200"></div>
        <div class="mt-4 h-6 w-3/5 rounded-xl bg-slate-200"></div>
        <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div class="space-y-3">
            <div class="h-4 w-full rounded bg-slate-200"></div>
            <div class="h-4 w-5/6 rounded bg-slate-200"></div>
            <div class="h-4 w-2/3 rounded bg-slate-200"></div>
          </div>
          <div class="aspect-[4/3] rounded-[28px] bg-slate-200"></div>
        </div>
      </div>

      <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div class="rounded-[28px] bg-slate-200/70 p-8">
          <div class="space-y-4">
            <div class="h-4 w-full rounded bg-slate-200"></div>
            <div class="h-4 w-full rounded bg-slate-200"></div>
            <div class="h-4 w-5/6 rounded bg-slate-200"></div>
            <div class="h-4 w-full rounded bg-slate-200"></div>
          </div>
        </div>
        <div class="hidden rounded-[28px] bg-slate-200/70 lg:block"></div>
      </div>
    </div>

    <article v-else-if="eventItem" class="mx-auto max-w-5xl">
      <div class="mb-5">
        <router-link
          to="/events"
          class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 19l-7-7 7-7" />
          </svg>
          Tutti gli eventi
        </router-link>
      </div>

      <header class="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 shadow-sm shadow-slate-900/5">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(74,144,217,0.12),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(80,184,96,0.12),_transparent_28%)]" />

        <div class="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:p-10">
          <div class="min-w-0">
            <div class="mb-5 flex flex-wrap items-center gap-2">
              <span class="badge bg-white/80 text-primary ring-1 ring-primary/10">Evento pubblico</span>
              <span class="badge bg-white/80 text-slate-600 ring-1 ring-slate-200">{{ formattedDate }}</span>
              <span class="badge bg-white/80 text-slate-600 ring-1 ring-slate-200">{{ formattedTime }}</span>
            </div>

            <h1 class="max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              {{ eventItem.title }}
            </h1>

            <p v-if="eventItem.excerpt" class="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              {{ eventItem.excerpt }}
            </p>

            <div class="mt-8 flex flex-wrap items-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                MC
              </div>
              <div>
                <p class="text-sm font-semibold text-slate-950">{{ eventItem.organizer }}</p>
                <p class="text-sm text-slate-500">Organizzazione e facilitazione dell'incontro</p>
              </div>
            </div>

            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <div class="rounded-[24px] border border-white/80 bg-white/75 p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Dove</p>
                <p class="mt-2 text-sm font-semibold text-slate-950">{{ locationLabel }}</p>
              </div>
              <div class="rounded-[24px] border border-white/80 bg-white/75 p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Quando</p>
                <p class="mt-2 text-sm font-semibold text-slate-950">{{ formattedDate }} · {{ formattedTime }}</p>
              </div>
            </div>
          </div>

          <ArticleCover
            :src="eventItem.coverImage"
            :alt="eventItem.title"
            container-class="min-h-[280px] overflow-hidden rounded-[28px] border border-white/80 bg-white/80 shadow-xl shadow-slate-900/10"
            image-class="aspect-[4/3] h-full w-full object-cover"
            placeholder-class="min-h-[280px]"
          />
        </div>
      </header>

      <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div class="min-w-0">
          <div class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-8 lg:p-10">
            <ArticleRenderer :html="eventItem.body" />
          </div>
        </div>

        <aside class="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div class="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">In breve</p>
            <div class="mt-5 space-y-4">
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Data</p>
                <p class="mt-1 text-sm font-medium text-slate-900">{{ formattedDate }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Orario</p>
                <p class="mt-1 text-sm font-medium text-slate-900">{{ formattedTime }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Luogo</p>
                <p class="mt-1 text-sm font-medium text-slate-900">{{ locationLabel }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Organizzatore</p>
                <p class="mt-1 text-sm font-medium text-slate-900">{{ eventItem.organizer }}</p>
              </div>
            </div>
          </div>

          <div class="rounded-[28px] border border-primary/10 bg-primary/5 p-6">
            <p class="text-sm font-semibold text-slate-900">Scopri altri appuntamenti</p>
            <p class="mt-2 text-sm leading-7 text-slate-600">
              Se questo incontro ti interessa, puoi continuare a esplorare l'agenda pubblica e trovare altri eventi aperti.
            </p>
            <router-link to="/events" class="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark">
              Vai all'agenda
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5l7 7-7 7" />
              </svg>
            </router-link>
          </div>
        </aside>
      </div>
    </article>

    <div v-else class="mx-auto max-w-2xl py-16 text-center">
      <div class="rounded-[28px] border border-slate-200 bg-white px-6 py-10 shadow-sm shadow-slate-900/5">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9.172 9.172a4 4 0 115.656 5.656M9 13h.01M15 11h.01M12 6h.01M12 18h.01M6 12h.01M18 12h.01" />
          </svg>
        </div>
        <h2 class="mt-5 text-2xl font-semibold text-slate-950">Evento non disponibile</h2>
        <p class="mt-3 text-base leading-7 text-slate-600">
          Il contenuto potrebbe essere stato rimosso oppure il link non e corretto.
        </p>
        <router-link to="/events" class="btn-primary mt-6 inline-flex items-center gap-2">
          Torna agli eventi
        </router-link>
      </div>
    </div>
  </div>
</template>
