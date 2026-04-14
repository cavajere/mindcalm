<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import ArticleCover from '../components/ArticleCover.vue'

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

const nextEvent = computed(() => events.value[0] ?? null)

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
    const { data } = await axios.get('/api/events?limit=50')
    events.value = data.data
  } finally {
    loading.value = false
  }
}

onMounted(fetchEvents)
</script>

<template>
  <div class="page-container space-y-8 pb-10">
    <section class="section-panel relative overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(74,144,217,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(80,184,96,0.12),_transparent_26%)]" />

      <div class="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] lg:p-10">
        <div>
          <span class="eyebrow">Agenda pubblica</span>
          <h1 class="font-display mt-4 text-4xl font-semibold leading-none text-slate-950 sm:text-5xl">
            Eventi pensati per incontrarsi con piu presenza.
          </h1>
          <p class="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
            Workshop, incontri e appuntamenti aperti per portare la pratica fuori dallo schermo e dentro la vita quotidiana.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div class="rounded-[26px] border border-white/80 bg-white/75 p-4 backdrop-blur-sm">
            <p class="text-2xl font-semibold text-slate-950">{{ events.length }}</p>
            <p class="mt-1 text-sm text-slate-600">eventi visibili</p>
          </div>
          <div class="rounded-[26px] border border-white/80 bg-white/75 p-4 backdrop-blur-sm">
            <p class="text-sm font-semibold text-slate-950">
              {{ nextEvent ? formatEventDate(nextEvent.startsAt) : 'Nessun evento in calendario' }}
            </p>
            <p class="mt-1 text-sm text-slate-600">prossimo appuntamento</p>
          </div>
        </div>
      </div>
    </section>

    <div v-if="loading" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="item in 6" :key="item" class="card animate-pulse overflow-hidden">
        <div class="aspect-[4/3] bg-slate-200"></div>
        <div class="space-y-3 p-5">
          <div class="h-3 w-24 rounded-full bg-slate-200"></div>
          <div class="h-8 w-4/5 rounded-2xl bg-slate-200"></div>
          <div class="h-4 w-full rounded bg-slate-200"></div>
          <div class="h-4 w-3/4 rounded bg-slate-200"></div>
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
        <ArticleCover
          :src="eventItem.coverImage"
          :alt="eventItem.title"
          container-class="aspect-[4/3] overflow-hidden"
          image-class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div class="p-5">
          <div class="flex items-start gap-4">
            <div class="flex min-h-16 min-w-16 flex-col items-center justify-center rounded-[22px] bg-primary/10 text-primary">
              <span class="text-lg font-semibold leading-none">{{ formatCompactEventDate(eventItem.startsAt).split(' ')[0] }}</span>
              <span class="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                {{ formatCompactEventDate(eventItem.startsAt).split(' ').slice(1).join(' ') }}
              </span>
            </div>

            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {{ eventItem.city }}<span v-if="eventItem.venue"> · {{ eventItem.venue }}</span>
              </p>
              <h2 class="mt-2 text-xl font-semibold leading-tight text-slate-950">{{ eventItem.title }}</h2>
              <p class="mt-2 text-sm font-medium text-primary">{{ eventItem.organizer }}</p>
            </div>
          </div>

          <p class="mt-4 text-sm leading-7 text-slate-600">
            {{ eventItem.excerpt || 'Un incontro aperto per approfondire pratica, ascolto e strumenti utili da portare nella settimana.' }}
          </p>
        </div>
      </router-link>
    </div>

    <div v-else class="section-panel p-8 text-center sm:p-10">
      <div class="mx-auto max-w-2xl">
        <span class="eyebrow">Agenda in aggiornamento</span>
        <h2 class="mt-5 text-2xl font-semibold text-slate-950 sm:text-3xl">Nessun evento pubblico disponibile in questo momento.</h2>
        <p class="mt-4 text-base leading-8 text-slate-600">
          Quando saranno programmati nuovi appuntamenti, li troverai qui con data, luogo e tutti i dettagli utili.
        </p>
        <router-link to="/" class="btn-secondary mt-6 inline-flex">Torna alla home</router-link>
      </div>
    </div>
  </div>
</template>
