<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'

type PeriodPreset = '7' | '30' | '90' | 'custom'

const loading = ref(true)
const loadingFilters = ref(true)
const error = ref('')

const periodPreset = ref<PeriodPreset>('30')
const filters = ref({
  dateFrom: '',
  dateTo: '',
  categoryId: '',
  audioId: '',
  thoughtId: '',
  userId: '',
})

const filterOptions = ref<{
  categories: Array<{ id: string; name: string }>
  audio: Array<{ id: string; title: string; category: { id: string; name: string } }>
  thoughts: Array<{ id: string; title: string; author: string }>
  users: Array<{ id: string; name: string; email: string; role: 'ADMIN' | 'STANDARD' }>
}>({
  categories: [],
  audio: [],
  thoughts: [],
  users: [],
})

const overview = ref<{
  totals: {
    audioViews: number
    audioPlays: number
    audioCompletions: number
    thoughtViews: number
    errorEvents: number
    activeUsers: number
  }
  topAudio: Array<{
    id: string
    title: string
    categoryName: string
    viewCount: number
    playCount: number
    completionCount: number
    completionRate: number
    dropOffCount: number
    dropOffRate: number
  }>
  audioPerformance: Array<{
    id: string
    title: string
    categoryName: string
    viewCount: number
    playCount: number
    completionCount: number
    completionRate: number
    dropOffCount: number
    dropOffRate: number
  }>
  topDropoffAudio: Array<{
    id: string
    title: string
    categoryName: string
    viewCount: number
    playCount: number
    completionCount: number
    completionRate: number
    dropOffCount: number
    dropOffRate: number
  }>
  topThoughts: Array<{
    id: string
    title: string
    author: string
    viewCount: number
  }>
  topUsers: Array<{
    id: string
    name: string
    email: string
    role: 'ADMIN' | 'STANDARD'
    totalEvents: number
    audioViews: number
    audioPlays: number
    audioCompletions: number
    thoughtViews: number
  }>
  dailyActivity: Array<{
    date: string
    audioViews: number
    audioPlays: number
    audioCompletions: number
    thoughtViews: number
    errorEvents: number
  }>
  recentEvents: Array<{
    id: string
    eventType:
      | 'AUDIO_VIEW'
      | 'AUDIO_PLAY'
      | 'AUDIO_COMPLETE'
      | 'THOUGHT_VIEW'
      | 'APP_ERROR'
      | 'API_ERROR'
      | 'AUDIO_ERROR'
      | 'SERVER_ERROR'
    occurredAt: string
    metadata: Record<string, unknown> | null
    user: { id: string; name: string; email: string } | null
    audio: { id: string; title: string; categoryName: string } | null
    thought: { id: string; title: string; author: string } | null
  }>
} | null>(null)

const filteredAudio = computed(() =>
  filterOptions.value.audio.filter((item) =>
    !filters.value.categoryId || item.category.id === filters.value.categoryId,
  ),
)

const maxDailyEvents = computed(() =>
  Math.max(
    1,
    ...(overview.value?.dailyActivity.map((day) =>
      day.audioViews + day.audioPlays + day.audioCompletions + day.thoughtViews + day.errorEvents,
    ) || [1]),
  ),
)

const completionRate = computed(() => {
  if (!overview.value || overview.value.totals.audioPlays === 0) return 0
  return Math.round((overview.value.totals.audioCompletions / overview.value.totals.audioPlays) * 100)
})

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function getDateOffsetInputValue(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function applyPresetDates() {
  if (periodPreset.value === 'custom') return

  const presetDays = Number(periodPreset.value)
  filters.value.dateTo = getTodayInputValue()
  filters.value.dateFrom = getDateOffsetInputValue(presetDays - 1)
}

async function fetchFilterOptions() {
  loadingFilters.value = true

  try {
    const { data } = await axios.get('/api/admin/analytics/filters')
    filterOptions.value = data
  } finally {
    loadingFilters.value = false
  }
}

async function fetchOverview() {
  loading.value = true
  error.value = ''

  try {
    const params = new URLSearchParams()

    if (periodPreset.value !== 'custom') {
      params.set('days', periodPreset.value)
    }

    if (filters.value.dateFrom) params.set('dateFrom', filters.value.dateFrom)
    if (filters.value.dateTo) params.set('dateTo', filters.value.dateTo)
    if (filters.value.categoryId && !filters.value.thoughtId) params.set('categoryId', filters.value.categoryId)
    if (filters.value.audioId) params.set('audioId', filters.value.audioId)
    if (filters.value.thoughtId) params.set('thoughtId', filters.value.thoughtId)
    if (filters.value.userId) params.set('userId', filters.value.userId)

    const { data } = await axios.get(`/api/admin/analytics/overview?${params.toString()}`)
    overview.value = data
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore nel caricamento analytics'
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  periodPreset.value = '30'
  filters.value = {
    dateFrom: getDateOffsetInputValue(29),
    dateTo: getTodayInputValue(),
    categoryId: '',
    audioId: '',
    thoughtId: '',
    userId: '',
  }
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('it-IT')
}

function roleLabel(role: 'ADMIN' | 'STANDARD') {
  return role === 'ADMIN' ? 'Admin' : 'Standard'
}

function eventLabel(eventType: string) {
  if (eventType === 'AUDIO_VIEW') return 'Vista audio'
  if (eventType === 'AUDIO_PLAY') return 'Play audio'
  if (eventType === 'AUDIO_COMPLETE') return 'Audio completato'
  if (eventType === 'APP_ERROR') return 'Errore app'
  if (eventType === 'API_ERROR') return 'Errore API'
  if (eventType === 'AUDIO_ERROR') return 'Errore audio'
  if (eventType === 'SERVER_ERROR') return 'Errore server'
  return 'Lettura pensiero'
}

function formatEventDetails(event: NonNullable<typeof overview.value>['recentEvents'][number]) {
  const metadata = event.metadata || {}

  const requestLabel =
    typeof metadata.requestMethod === 'string' && typeof metadata.requestPath === 'string'
      ? `${metadata.requestMethod} ${metadata.requestPath}`
      : typeof metadata.requestPath === 'string'
        ? metadata.requestPath
        : typeof metadata.routePath === 'string'
          ? metadata.routePath
          : null

  return [
    typeof metadata.source === 'string' ? metadata.source : null,
    requestLabel,
    typeof metadata.status === 'number' ? `HTTP ${metadata.status}` : null,
    typeof metadata.message === 'string' ? metadata.message : null,
  ].filter(Boolean).join(' · ') || 'n/d'
}

watch(periodPreset, () => {
  applyPresetDates()
  fetchOverview()
})

watch(() => filters.value.categoryId, () => {
  if (filters.value.thoughtId) return
  if (filters.value.audioId) {
    const selectedAudio = filterOptions.value.audio.find((item) => item.id === filters.value.audioId)
    if (selectedAudio && selectedAudio.category.id !== filters.value.categoryId) {
      filters.value.audioId = ''
    }
  }
})

watch(() => filters.value.thoughtId, (thoughtId) => {
  if (thoughtId) {
    filters.value.categoryId = ''
    filters.value.audioId = ''
  }
})

watch(() => filters.value.audioId, (audioId) => {
  if (audioId) {
    filters.value.thoughtId = ''
  }
})

onMounted(async () => {
  resetFilters()
  await fetchFilterOptions()
  await fetchOverview()
})
</script>

<template>
  <div>
    <PageHeader
      title="Analytics"
      description="Consultazione contenuti, riproduzioni e dettaglio eventi della PWA."
    />

    <div class="card mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div>
          <label class="label">Periodo</label>
          <select v-model="periodPreset" class="input-field">
            <option value="7">Ultimi 7 giorni</option>
            <option value="30">Ultimi 30 giorni</option>
            <option value="90">Ultimi 90 giorni</option>
            <option value="custom">Intervallo personalizzato</option>
          </select>
        </div>

        <div>
          <label class="label">Da</label>
          <input v-model="filters.dateFrom" type="date" class="input-field" @change="fetchOverview" />
        </div>

        <div>
          <label class="label">A</label>
          <input v-model="filters.dateTo" type="date" class="input-field" @change="fetchOverview" />
        </div>

        <div>
          <label class="label">Categoria</label>
          <select v-model="filters.categoryId" class="input-field" :disabled="!!filters.thoughtId || loadingFilters" @change="fetchOverview">
            <option value="">Tutte le categorie</option>
            <option v-for="category in filterOptions.categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Audio</label>
          <select v-model="filters.audioId" class="input-field" :disabled="!!filters.thoughtId || loadingFilters" @change="fetchOverview">
            <option value="">Tutti gli audio</option>
            <option v-for="audio in filteredAudio" :key="audio.id" :value="audio.id">
              {{ audio.title }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Pensiero</label>
          <select v-model="filters.thoughtId" class="input-field" :disabled="!!filters.categoryId || !!filters.audioId || loadingFilters" @change="fetchOverview">
            <option value="">Tutti i pensieri</option>
            <option v-for="article in filterOptions.thoughts" :key="article.id" :value="article.id">
              {{ article.title }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Utente</label>
          <select v-model="filters.userId" class="input-field" :disabled="loadingFilters" @change="fetchOverview">
            <option value="">Tutti gli utenti</option>
            <option v-for="user in filterOptions.users" :key="user.id" :value="user.id">
              {{ user.name }} · {{ user.email }}
            </option>
          </select>
        </div>

        <div class="flex items-end">
          <button type="button" @click="resetFilters(); fetchOverview()" class="btn-secondary w-full">
            Reset filtri
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
      {{ error }}
    </div>

    <div v-if="loading" class="text-sm text-text-secondary">Caricamento analytics...</div>

    <template v-else-if="overview">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-4 mb-8">
        <div class="card">
          <p class="text-sm text-text-secondary mb-1">Audio visti</p>
          <p class="text-3xl font-bold text-text-primary">{{ overview.totals.audioViews }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-text-secondary mb-1">Riproduzioni</p>
          <p class="text-3xl font-bold text-text-primary">{{ overview.totals.audioPlays }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-text-secondary mb-1">Audio completati</p>
          <p class="text-3xl font-bold text-text-primary">{{ overview.totals.audioCompletions }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-text-secondary mb-1">Pensieri letti</p>
          <p class="text-3xl font-bold text-text-primary">{{ overview.totals.thoughtViews }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-text-secondary mb-1">Errori app</p>
          <p class="text-3xl font-bold text-red-600">{{ overview.totals.errorEvents }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-text-secondary mb-1">Utenti attivi</p>
          <p class="text-3xl font-bold text-text-primary">{{ overview.totals.activeUsers }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-text-secondary mb-1">Completion rate</p>
          <p class="text-3xl font-bold text-text-primary">{{ completionRate }}%</p>
        </div>
      </div>

      <div class="card mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-text-primary">Andamento giornaliero</h2>
          <span class="text-xs text-text-secondary">
            {{ formatDay(filters.dateFrom) }} - {{ formatDay(filters.dateTo) }}
          </span>
        </div>

        <div class="grid grid-cols-7 lg:grid-cols-10 gap-3 items-end min-h-48">
          <div v-for="day in overview.dailyActivity" :key="day.date" class="flex flex-col items-center gap-2">
            <div class="w-full max-w-10 h-36 flex items-end">
              <div
                class="w-full rounded-t-lg bg-gradient-to-t from-primary to-secondary/60 min-h-1"
                :style="{ height: `${Math.max(4, ((day.audioViews + day.audioPlays + day.audioCompletions + day.thoughtViews + day.errorEvents) / maxDailyEvents) * 100)}%` }"
                :title="`${formatDay(day.date)} · ${(day.audioViews + day.audioPlays + day.audioCompletions + day.thoughtViews + day.errorEvents)} eventi`"
              />
            </div>
            <div class="text-[11px] text-text-secondary text-center">
              {{ formatDay(day.date) }}
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-text-primary">Audio più riprodotti</h2>
            <span class="text-xs text-text-secondary">{{ overview.topAudio.length }}</span>
          </div>

          <div v-if="overview.topAudio.length" class="space-y-3">
            <div v-for="audio in overview.topAudio" :key="audio.id" class="border border-gray-100 rounded-xl px-4 py-3">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-medium text-text-primary">{{ audio.title }}</p>
                  <p class="text-xs text-text-secondary mt-1">{{ audio.categoryName }}</p>
                </div>
                <div class="text-right text-xs text-text-secondary space-y-1 whitespace-nowrap">
                  <p>{{ audio.playCount }} play</p>
                  <p>{{ audio.completionCount }} complete</p>
                  <p>{{ audio.viewCount }} viste</p>
                </div>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-text-secondary">Nessuna riproduzione nel periodo selezionato.</p>
        </div>

        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-text-primary">Pensieri più letti</h2>
            <span class="text-xs text-text-secondary">{{ overview.topThoughts.length }}</span>
          </div>

          <div v-if="overview.topThoughts.length" class="space-y-3">
            <div v-for="article in overview.topThoughts" :key="article.id" class="border border-gray-100 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-text-primary">{{ article.title }}</p>
                <p class="text-xs text-text-secondary mt-1">{{ article.author }}</p>
              </div>
              <div class="text-right text-xs text-text-secondary whitespace-nowrap">
                {{ article.viewCount }} letture
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-text-secondary">Nessun pensiero letto nel periodo selezionato.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div class="card xl:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-text-primary">Performance audio</h2>
            <span class="text-xs text-text-secondary">{{ overview.audioPerformance.length }}</span>
          </div>

          <div v-if="overview.audioPerformance.length" class="table-container">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Audio</th>
                  <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Play</th>
                  <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Complete</th>
                  <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Completion rate</th>
                  <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Abbandoni</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr v-for="audio in overview.audioPerformance.slice(0, 10)" :key="audio.id" class="hover:bg-gray-50/50">
                  <td class="px-4 py-3 text-sm">
                    <p class="font-medium text-text-primary">{{ audio.title }}</p>
                    <p class="text-xs text-text-secondary mt-1">{{ audio.categoryName }}</p>
                  </td>
                  <td class="px-4 py-3 text-sm text-text-primary">{{ audio.playCount }}</td>
                  <td class="px-4 py-3 text-sm text-text-primary">{{ audio.completionCount }}</td>
                  <td class="px-4 py-3 text-sm text-text-primary">{{ audio.completionRate }}%</td>
                  <td class="px-4 py-3 text-sm text-text-primary">{{ audio.dropOffCount }} ({{ audio.dropOffRate }}%)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-else class="text-sm text-text-secondary">Nessun audio con play nel periodo selezionato.</p>
        </div>

        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-text-primary">Audio con più abbandoni</h2>
            <span class="text-xs text-text-secondary">{{ overview.topDropoffAudio.length }}</span>
          </div>

          <div v-if="overview.topDropoffAudio.length" class="space-y-3">
            <div v-for="audio in overview.topDropoffAudio" :key="audio.id" class="border border-gray-100 rounded-xl px-4 py-3">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-medium text-text-primary">{{ audio.title }}</p>
                  <p class="text-xs text-text-secondary mt-1">{{ audio.categoryName }}</p>
                </div>
                <div class="text-right text-xs text-text-secondary space-y-1 whitespace-nowrap">
                  <p>{{ audio.dropOffCount }} abbandoni</p>
                  <p>{{ audio.dropOffRate }}% drop-off</p>
                  <p>{{ audio.playCount }} play</p>
                </div>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-text-secondary">Nessun abbandono rilevato nel periodo selezionato.</p>
        </div>
      </div>

      <div class="card mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-text-primary">Utenti più attivi</h2>
          <span class="text-xs text-text-secondary">{{ overview.topUsers.length }}</span>
        </div>

        <div v-if="overview.topUsers.length" class="table-container">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Utente</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Ruolo</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Eventi</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Play</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Complete</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Pensieri</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="user in overview.topUsers" :key="user.id" class="hover:bg-gray-50/50">
                <td class="px-4 py-3 text-sm">
                  <p class="font-medium text-text-primary">{{ user.name }}</p>
                  <p class="text-xs text-text-secondary mt-1">{{ user.email }}</p>
                </td>
                <td class="px-4 py-3 text-sm text-text-primary">{{ roleLabel(user.role) }}</td>
                <td class="px-4 py-3 text-sm text-text-primary">{{ user.totalEvents }}</td>
                <td class="px-4 py-3 text-sm text-text-primary">{{ user.audioPlays }}</td>
                <td class="px-4 py-3 text-sm text-text-primary">{{ user.audioCompletions }}</td>
                <td class="px-4 py-3 text-sm text-text-primary">{{ user.thoughtViews }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="text-sm text-text-secondary">Nessun utente attivo nel periodo selezionato.</p>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-text-primary">Eventi recenti</h2>
          <span class="text-xs text-text-secondary">{{ overview.recentEvents.length }}</span>
        </div>

        <div v-if="overview.recentEvents.length" class="table-container">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Quando</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Evento</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Contenuto</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Dettagli</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Utente</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="event in overview.recentEvents" :key="event.id" class="hover:bg-gray-50/50">
                <td class="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">{{ formatDateTime(event.occurredAt) }}</td>
                <td class="px-4 py-3 text-sm text-text-primary">{{ eventLabel(event.eventType) }}</td>
                <td class="px-4 py-3 text-sm">
                  <div v-if="event.audio">
                    <p class="font-medium text-text-primary">{{ event.audio.title }}</p>
                    <p class="text-xs text-text-secondary mt-1">{{ event.audio.categoryName }}</p>
                  </div>
                  <div v-else-if="event.thought">
                    <p class="font-medium text-text-primary">{{ event.thought.title }}</p>
                    <p class="text-xs text-text-secondary mt-1">{{ event.thought.author }}</p>
                  </div>
                  <div v-else class="text-text-secondary">
                    Sistema
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-text-secondary">
                  {{ formatEventDetails(event) }}
                </td>
                <td class="px-4 py-3 text-sm">
                  <template v-if="event.user">
                    <p class="font-medium text-text-primary">{{ event.user.name }}</p>
                    <p class="text-xs text-text-secondary mt-1">{{ event.user.email }}</p>
                  </template>
                  <p v-else class="text-text-secondary">Anonimo</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="text-sm text-text-secondary">Nessun evento nel periodo selezionato.</p>
      </div>
    </template>
  </div>
</template>
