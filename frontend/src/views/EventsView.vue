<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import ContentCover from '../components/ContentCover.vue'
import SearchLoader from '../components/SearchLoader.vue'
import { useAdvancedSearch } from '../composables/useAdvancedSearch'

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
  cancelledAt: string | null
  bookingRequired: boolean
  bookingAvailable: boolean
  participationMode: 'FREE' | 'PAID'
  participationPriceCents: number | null
}

const events = ref<EventItem[]>([])
const allEvents = ref<EventItem[]>([])
const loading = ref(true)

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
  onClear: loadAllEvents
})

const upcomingEvents = computed(() => {
  const now = new Date()
  return events.value.filter(e => !e.cancelledAt && new Date(e.startsAt) > now)
})
const nextEvent = computed(() => upcomingEvents.value[0] ?? null)

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

async function fetchEvents(query?: string) {
  loading.value = true

  const params = new URLSearchParams({ limit: '1000' })
  const trimmedQuery = query?.trim()
  if (trimmedQuery) params.set('search', trimmedQuery)

  const logPayload = {
    query: trimmedQuery || '',
    limit: 1000,
  }

  console.info('[Search][EventsView] request', logPayload)

  try {
    const { data } = await axios.get(`/api/events?${params.toString()}`)
    allEvents.value = data.data
    events.value = data.data

    console.info('[Search][EventsView] response', {
      ...logPayload,
      resultCount: data.data.length,
      total: data.pagination?.total ?? data.data.length,
    })
  } catch (error) {
    console.error('[Search][EventsView] request failed', logPayload, error)
    throw error
  } finally {
    loading.value = false
  }
}

async function loadAllEvents() {
  await fetchEvents()
}

async function performSearch(query: string) {
  await fetchEvents(query)
}

watch(hasValidQuery, (isValid) => {
  if (!isValid && searchQuery.value.trim().length === 0 && allEvents.value.length) {
    events.value = allEvents.value
  }
})

onMounted(() => {
  void loadAllEvents()
})
</script>

<template>
  <div class="page-container">
    <h1 class="text-3xl font-bold text-text-primary mb-8">Eventi e incontri</h1>

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
          placeholder="Cerca eventi..."
          class="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>
    </div>

    <!-- Search loader -->
    <SearchLoader :visible="showSearchLoader" message="Ricerca eventi..." />

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

    <div v-else-if="events.length && !isSearching" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <router-link
        v-for="eventItem in events"
        :key="eventItem.id"
        :to="`/events/${eventItem.slug}`"
        class="card group overflow-hidden"
      >
        <ContentCover
          v-if="eventItem.coverImage"
          :src="eventItem.coverImage"
          :alt="eventItem.title"
          container-class="aspect-[4/3] overflow-hidden"
          image-class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div class="p-5" :class="{ 'pt-6': !eventItem.coverImage }">
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
              <p v-if="eventItem.cancelledAt" class="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-red-700">
                Evento annullato
              </p>
              <p v-else-if="eventItem.bookingRequired && eventItem.bookingAvailable" class="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Prenotazioni aperte
              </p>
              <p class="mt-2 text-xs font-semibold uppercase tracking-[0.16em]" :class="eventItem.participationMode === 'PAID' ? 'text-amber-700' : 'text-sky-700'">
                {{ eventItem.participationMode === 'PAID' && eventItem.participationPriceCents != null ? `A pagamento · € ${(eventItem.participationPriceCents / 100).toFixed(2)}` : 'Partecipazione gratuita' }}
                · {{ eventItem.bookingRequired ? 'con prenotazione' : 'senza prenotazione' }}
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

    <!-- Vuoto -->
    <div v-else-if="!loading && !isSearching" class="text-center py-16">
      <p class="text-text-secondary text-lg">Nessun evento trovato</p>
      <p class="text-text-secondary text-sm mt-2">Prova a cambiare i filtri</p>
    </div>
  </div>
</template>
