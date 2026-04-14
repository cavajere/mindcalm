<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import ContentCover from '../components/ContentCover.vue'

interface EventItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
  organizer: string
  city: string
  venue: string | null
  startsAt: string
  coverImage: string | null
}

const events = ref<EventItem[]>([])
const loading = ref(true)
const search = ref('')

const nextEvent = computed(() => events.value[0] ?? null)
const activeFiltersLabel = computed(() => search.value.trim() ? 'ricerca attiva' : 'Nessun filtro attivo')

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatCompactEventDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
  })
}

async function fetchEvents() {
  loading.value = true

  try {
    const query = new URLSearchParams({ limit: '50' })

    if (search.value.trim()) {
      query.set('search', search.value.trim())
    }

    const { data } = await axios.get(`/api/events?${query}`)
    events.value = data.data
  } finally {
    loading.value = false
  }
}

onMounted(fetchEvents)

let searchTimeout: number
watch(search, () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    fetchEvents()
  }, 350)
})
</script>

<template>
  <div class="page-container space-y-8 pb-10">
    <section class="section-panel relative overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(74,144,217,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(80,184,96,0.12),_transparent_26%)]" />

      <div class="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] lg:p-10">
        <div>
          <span class="eyebrow">Eventi pubblici</span>
          <h1 class="font-display mt-4 text-4xl font-semibold leading-none text-text-primary sm:text-5xl">
            Eventi, incontri e appuntamenti aperti.
          </h1>
          <p class="mt-4 max-w-3xl text-base leading-8 text-text-secondary sm:text-lg">
            Consulta gli eventi pubblici di MindCalm e cerca per parole chiave tra titoli, luoghi, organizzatori e descrizioni.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div class="surface-card-muted p-4">
            <p class="text-2xl font-semibold text-text-primary">{{ events.length }}</p>
            <p class="mt-1 text-sm text-text-secondary">eventi visibili</p>
          </div>
          <div class="surface-card-muted p-4">
            <p class="text-sm font-semibold text-text-primary">
              {{ nextEvent ? formatEventDate(nextEvent.startsAt) : activeFiltersLabel }}
            </p>
            <p class="mt-1 text-sm text-text-secondary">
              {{ nextEvent ? 'prossimo appuntamento' : 'stato della ricerca' }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="card p-5 sm:p-6">
      <label class="mb-2 block text-sm font-semibold text-text-primary">Cerca negli eventi</label>
      <div class="relative">
        <svg class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Cerca per titolo, citta, luogo o organizzatore..."
          class="w-full rounded-[22px] border border-ui-border bg-surface/92 py-3 pl-12 pr-4 transition-all"
        />
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

    <div v-else-if="events.length" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <router-link
        v-for="eventItem in events"
        :key="eventItem.id"
        :to="`/events/${eventItem.slug}`"
        class="card group overflow-hidden"
      >
        <ContentCover
          :src="eventItem.coverImage"
          :alt="eventItem.title"
          container-class="aspect-[4/3] overflow-hidden"
          image-class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div class="p-5">
          <div class="flex items-start gap-4">
            <div class="surface-card-muted flex min-h-16 min-w-16 flex-col items-center justify-center text-primary">
              <span class="text-lg font-semibold leading-none">{{ formatCompactEventDate(eventItem.startsAt).split(' ')[0] }}</span>
              <span class="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                {{ formatCompactEventDate(eventItem.startsAt).split(' ').slice(1).join(' ') }}
              </span>
            </div>

            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                {{ eventItem.city }}<span v-if="eventItem.venue"> · {{ eventItem.venue }}</span>
              </p>
              <h2 class="mt-2 text-xl font-semibold leading-tight text-text-primary">{{ eventItem.title }}</h2>
              <p class="mt-2 text-sm font-medium text-primary">{{ eventItem.organizer }}</p>
            </div>
          </div>

          <p class="mt-4 text-sm leading-7 text-text-secondary">
            {{ eventItem.excerpt || 'Un incontro aperto per approfondire pratica, ascolto e strumenti utili da portare nella settimana.' }}
          </p>
        </div>
      </router-link>
    </div>

    <div v-else class="section-panel p-8 text-center sm:p-10">
      <div class="mx-auto max-w-2xl">
        <span class="eyebrow">Nessun risultato</span>
        <h2 class="mt-5 text-2xl font-semibold text-text-primary sm:text-3xl">Non ci sono eventi che corrispondono alla ricerca.</h2>
        <p class="mt-4 text-base leading-8 text-text-secondary">
          Prova con un'altra parola chiave oppure torna piu tardi per vedere i prossimi appuntamenti pubblici.
        </p>
        <router-link to="/" class="btn-secondary mt-6 inline-flex">Torna alla home</router-link>
      </div>
    </div>
  </div>
</template>
