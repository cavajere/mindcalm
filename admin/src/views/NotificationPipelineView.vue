<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'

type NotificationPipelineStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED'
type NotificationFrequency = 'IMMEDIATE' | 'WEEKLY' | 'MONTHLY'

type NotificationPipelineJob = {
  id: string
  userId: string
  user: {
    id: string
    email: string
    name: string
  }
  frequency: NotificationFrequency
  status: NotificationPipelineStatus
  recipientEmail: string
  recipientName: string
  subject: string
  title: string
  intro: string
  itemCount: number
  items: Array<{
    type: 'audio' | 'thought'
    title: string
    publishedAt: string | null
  }>
  windowStartedAt: string
  windowEndedAt: string
  scheduledFor: string
  availableAt: string
  lockedAt: string | null
  startedAt: string | null
  sentAt: string | null
  failedAt: string | null
  lastError: string | null
  attemptCount: number
  maxAttempts: number
  createdAt: string
  updatedAt: string
}

type NotificationPipelineResponse = {
  data: NotificationPipelineJob[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: Record<NotificationPipelineStatus, number>
}

const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const success = ref('')
const jobs = ref<NotificationPipelineJob[]>([])
const summary = ref<Record<NotificationPipelineStatus, number>>({
  PENDING: 0,
  PROCESSING: 0,
  SENT: 0,
  FAILED: 0,
})
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
})
const statusFilter = ref<'ALL' | NotificationPipelineStatus>('ALL')
const retryingJobId = ref<string | null>(null)

let refreshTimer: ReturnType<typeof setInterval> | null = null

const summaryCards = computed(() => ([
  {
    label: 'Pendenti',
    value: summary.value.PENDING.toLocaleString('it-IT'),
    hint: 'Pronti o in attesa di retry',
  },
  {
    label: 'In lavorazione',
    value: summary.value.PROCESSING.toLocaleString('it-IT'),
    hint: 'Acquisiti dal worker',
  },
  {
    label: 'Completati',
    value: summary.value.SENT.toLocaleString('it-IT'),
    hint: 'Consegnati con successo',
  },
  {
    label: 'Falliti',
    value: summary.value.FAILED.toLocaleString('it-IT'),
    hint: 'Errori terminali da verificare',
  },
]))

function formatDateTime(value: string | null) {
  if (!value) {
    return 'N/D'
  }

  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function frequencyLabel(frequency: NotificationFrequency) {
  if (frequency === 'WEEKLY') return 'Weekly'
  if (frequency === 'MONTHLY') return 'Monthly'
  return 'Immediate'
}

function statusLabel(status: NotificationPipelineStatus) {
  if (status === 'PENDING') return 'In coda'
  if (status === 'PROCESSING') return 'In lavorazione'
  if (status === 'SENT') return 'Inviata'
  return 'Fallita'
}

function statusClasses(status: NotificationPipelineStatus) {
  if (status === 'PENDING') {
    return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
  }

  if (status === 'PROCESSING') {
    return 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200'
  }

  if (status === 'SENT') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
  }

  return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200'
}

function buildItemsPreview(job: NotificationPipelineJob) {
  const preview = job.items.slice(0, 3).map((item) => item.title)

  if (job.items.length > 3) {
    preview.push(`+${job.items.length - 3} altri`)
  }

  return preview
}

function setStatusFilter(status: 'ALL' | NotificationPipelineStatus) {
  statusFilter.value = status
}

async function fetchPipeline(background = false) {
  if (background) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  error.value = ''
  if (!background) {
    success.value = ''
  }

  try {
    const { data } = await axios.get<NotificationPipelineResponse>('/api/admin/settings/notifications/pipeline', {
      params: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        status: statusFilter.value === 'ALL' ? undefined : statusFilter.value,
      },
    })

    jobs.value = data.data
    pagination.value = data.pagination
    summary.value = data.summary
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Caricamento pipeline notifiche fallito'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function retryJob(jobId: string) {
  retryingJobId.value = jobId
  error.value = ''
  success.value = ''

  try {
    await axios.post(`/api/admin/settings/notifications/pipeline/${jobId}/retry`)
    success.value = 'Job rimesso in coda'
    await fetchPipeline(true)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Retry job fallito'
  } finally {
    retryingJobId.value = null
  }
}

function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > pagination.value.totalPages || nextPage === pagination.value.page) {
    return
  }

  pagination.value.page = nextPage
  fetchPipeline(true)
}

watch(statusFilter, () => {
  pagination.value.page = 1
  fetchPipeline(true)
})

onMounted(() => {
  fetchPipeline()
  refreshTimer = setInterval(() => {
    fetchPipeline(true)
  }, 15000)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<template>
  <div>
    <PageHeader
      title="Pipeline notifiche"
      description="Coda persistita delle notifiche email con stato, tentativi, finestre di contenuto e ultimi errori."
    >
      <template #actions>
        <router-link to="/settings/notifications" class="btn-secondary">
          Impostazioni
        </router-link>
        <button class="btn-secondary" :disabled="refreshing || loading" @click="fetchPipeline(true)">
          {{ refreshing ? 'Aggiornamento...' : 'Aggiorna ora' }}
        </button>
      </template>
    </PageHeader>

    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div v-for="card in summaryCards" :key="card.label" class="card">
        <p class="text-sm text-text-secondary">{{ card.label }}</p>
        <p class="mt-2 text-3xl font-semibold text-text-primary">{{ card.value }}</p>
        <p class="mt-2 text-sm text-text-secondary">{{ card.hint }}</p>
      </div>
    </div>

    <div v-if="error" class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ error }}
    </div>
    <div v-if="success" class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {{ success }}
    </div>

    <div class="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-sm font-semibold text-text-primary">Filtro stato</p>
        <p class="mt-1 text-sm text-text-secondary">
          Aggiornamento automatico ogni 15 secondi.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="status in ['ALL', 'PENDING', 'PROCESSING', 'SENT', 'FAILED']"
          :key="status"
          type="button"
          class="rounded-full px-4 py-2 text-sm font-medium transition"
          :class="statusFilter === status ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          @click="setStatusFilter(status as 'ALL' | NotificationPipelineStatus)"
        >
          {{ status === 'ALL' ? 'Tutti' : statusLabel(status as NotificationPipelineStatus) }}
        </button>
      </div>
    </div>

    <div v-if="loading && jobs.length === 0" class="card text-sm text-text-secondary">
      Caricamento pipeline notifiche...
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="job in jobs"
        :key="job.id"
        class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-3">
              <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusClasses(job.status)">
                {{ statusLabel(job.status) }}
              </span>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {{ frequencyLabel(job.frequency) }}
              </span>
              <span class="text-xs text-text-secondary">
                {{ job.itemCount }} contenuti
              </span>
            </div>

            <h2 class="mt-4 text-lg font-semibold text-text-primary">{{ job.subject }}</h2>
            <p class="mt-1 text-sm text-text-secondary">
              {{ job.recipientName }} · {{ job.recipientEmail }}
            </p>

            <div v-if="job.status === 'FAILED'" class="mt-4">
              <button
                type="button"
                class="btn-secondary"
                :disabled="retryingJobId === job.id"
                @click="retryJob(job.id)"
              >
                {{ retryingJobId === job.id ? 'Retry...' : 'Rimetti in coda' }}
              </button>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Finestra contenuti</p>
                <p class="mt-2 text-sm text-text-primary">
                  {{ formatDateTime(job.windowStartedAt) }} → {{ formatDateTime(job.windowEndedAt) }}
                </p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Scheduling</p>
                <p class="mt-2 text-sm text-text-primary">Slot {{ formatDateTime(job.scheduledFor) }}</p>
                <p class="mt-1 text-sm text-text-secondary">Disponibile da {{ formatDateTime(job.availableAt) }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Tentativi</p>
                <p class="mt-2 text-sm text-text-primary">{{ job.attemptCount }} / {{ job.maxAttempts }}</p>
                <p class="mt-1 text-sm text-text-secondary">Creato {{ formatDateTime(job.createdAt) }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Esito</p>
                <p class="mt-2 text-sm text-text-primary">
                  {{ formatDateTime(job.sentAt || job.failedAt || job.startedAt) }}
                </p>
                <p class="mt-1 text-sm text-text-secondary">
                  Lock {{ formatDateTime(job.lockedAt) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div class="rounded-2xl bg-slate-50 px-4 py-4">
            <p class="text-sm font-semibold text-text-primary">Contenuti nel job</p>
            <div v-if="job.items.length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="label in buildItemsPreview(job)"
                :key="label"
                class="rounded-full bg-white px-3 py-1 text-sm text-slate-700 ring-1 ring-inset ring-slate-200"
              >
                {{ label }}
              </span>
            </div>
            <p v-else class="mt-3 text-sm text-text-secondary">Nessun dettaglio contenuti disponibile.</p>
          </div>

          <div class="rounded-2xl bg-slate-50 px-4 py-4">
            <p class="text-sm font-semibold text-text-primary">Ultimo errore</p>
            <p class="mt-3 text-sm leading-6 text-text-secondary">
              {{ job.lastError || 'Nessun errore registrato' }}
            </p>
          </div>
        </div>
      </article>

      <div v-if="jobs.length === 0" class="card text-sm text-text-secondary">
        Nessuna notifica presente con il filtro selezionato.
      </div>

      <div class="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-text-secondary">
          Pagina {{ pagination.page }} di {{ pagination.totalPages }} · {{ pagination.total.toLocaleString('it-IT') }} job
        </p>

        <div class="flex gap-2">
          <button class="btn-secondary" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">
            Precedente
          </button>
          <button class="btn-secondary" :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">
            Successiva
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
