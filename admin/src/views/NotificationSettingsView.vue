<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'

type NotificationSettings = {
  immediateHourUtc: number
  weeklyHourUtc: number
  weeklyDayOfWeek: number
  monthlyHourUtc: number
  monthlyDayOfMonth: number
  batchSize: number
  maxAttempts: number
  retryBaseDelayMinutes: number
  lockTimeoutMinutes: number
  retentionDays: number
}

type NotificationStats = {
  configuredUsers: number
  pendingJobs: number
  processingJobs: number
  failedJobs: number
  sentLast24h: number
  lastSentAt: string | null
  nextQueuedAt: string | null
  schedulerIntervalMinutes: number
  workerIntervalSeconds: number
}

type NotificationSettingsResponse = {
  settings: NotificationSettings
  stats: NotificationStats
}

const loading = ref(false)
const refreshing = ref(false)
const error = ref('')
const success = ref('')
const stats = ref<NotificationStats | null>(null)
const form = ref<NotificationSettings>({
  immediateHourUtc: 9,
  weeklyHourUtc: 9,
  weeklyDayOfWeek: 1,
  monthlyHourUtc: 9,
  monthlyDayOfMonth: 1,
  batchSize: 20,
  maxAttempts: 5,
  retryBaseDelayMinutes: 5,
  lockTimeoutMinutes: 15,
  retentionDays: 30,
})

const weekDays = [
  'Domenica',
  'Lunedi',
  'Martedi',
  'Mercoledi',
  'Giovedi',
  'Venerdi',
  'Sabato',
]

const summaryCards = computed(() => {
  if (!stats.value) {
    return []
  }

  return [
    {
      label: 'Utenti configurati',
      value: stats.value.configuredUsers.toLocaleString('it-IT'),
      hint: 'Account con frequenza notifiche attiva',
    },
    {
      label: 'In coda',
      value: stats.value.pendingJobs.toLocaleString('it-IT'),
      hint: 'Job pronti o in attesa di retry',
    },
    {
      label: 'In lavorazione',
      value: stats.value.processingJobs.toLocaleString('it-IT'),
      hint: 'Job attualmente acquisiti dal worker',
    },
    {
      label: 'Inviate 24h',
      value: stats.value.sentLast24h.toLocaleString('it-IT'),
      hint: stats.value.failedJobs > 0
        ? `${stats.value.failedJobs.toLocaleString('it-IT')} job falliti da verificare`
        : 'Nessun errore terminale aperto',
    },
  ]
})

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Nessun evento recente'
  }

  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00 UTC`
}

async function fetchSettings(background = false) {
  if (background) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  error.value = ''

  try {
    const { data } = await axios.get<NotificationSettingsResponse>('/api/admin/settings/notifications')
    form.value = { ...data.settings }
    stats.value = data.stats
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Caricamento impostazioni notifiche fallito'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function saveSettings() {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    await axios.put('/api/admin/settings/notifications', form.value)
    success.value = 'Impostazioni notifiche salvate'
    await fetchSettings(true)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Salvataggio impostazioni notifiche fallito'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div>
    <PageHeader
      title="Notifiche"
      description="Gestisci la pianificazione delle notifiche contenuti e i parametri operativi della pipeline asincrona."
    >
      <template #actions>
        <router-link to="/settings/notifications/pipeline" class="btn-secondary">
          Apri pipeline
        </router-link>
        <button class="btn-secondary" :disabled="refreshing || loading" @click="fetchSettings(true)">
          {{ refreshing ? 'Aggiornamento...' : 'Aggiorna metriche' }}
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ error }}
    </div>
    <div v-if="success" class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {{ success }}
    </div>

    <div v-if="loading && !stats" class="card text-sm text-text-secondary">
      Caricamento impostazioni notifiche...
    </div>

    <template v-else>
      <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div v-for="card in summaryCards" :key="card.label" class="card">
          <p class="text-sm text-text-secondary">{{ card.label }}</p>
          <p class="mt-2 text-3xl font-semibold text-text-primary">{{ card.value }}</p>
          <p class="mt-2 text-sm text-text-secondary">{{ card.hint }}</p>
        </div>
      </div>

      <div class="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div class="card xl:col-span-2">
          <p class="text-sm font-semibold text-text-primary">Motore asincrono</p>
          <p class="mt-2 text-sm leading-6 text-text-secondary">
            Le notifiche vengono generate in coda e inviate da un worker separato con lock, retry progressivo e retention storica.
          </p>

          <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Scheduler</p>
              <p class="mt-2 text-lg font-semibold text-text-primary">
                ogni {{ stats?.schedulerIntervalMinutes ?? 5 }} minuti
              </p>
              <p class="mt-1 text-sm text-text-secondary">Controlla quali utenti devono ricevere nuovi job.</p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Worker</p>
              <p class="mt-2 text-lg font-semibold text-text-primary">
                ogni {{ stats?.workerIntervalSeconds ?? 30 }} secondi
              </p>
              <p class="mt-1 text-sm text-text-secondary">Acquisisce i job pendenti e aggiorna lo stato della pipeline.</p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Ultimo invio</p>
              <p class="mt-2 text-lg font-semibold text-text-primary">{{ formatDateTime(stats?.lastSentAt ?? null) }}</p>
              <p class="mt-1 text-sm text-text-secondary">Ultimo job completato con successo.</p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Prossimo job disponibile</p>
              <p class="mt-2 text-lg font-semibold text-text-primary">{{ formatDateTime(stats?.nextQueuedAt ?? null) }}</p>
              <p class="mt-1 text-sm text-text-secondary">Primo elemento attualmente in attesa nella coda.</p>
            </div>
          </div>
        </div>

        <div class="card">
          <p class="text-sm font-semibold text-text-primary">Regole attive</p>
          <div class="mt-4 space-y-4 text-sm text-text-secondary">
            <div class="rounded-2xl bg-slate-50 px-4 py-3">
              <p class="font-medium text-text-primary">Immediate</p>
              <p class="mt-1">Un job viene accodato appena un nuovo contenuto viene pubblicato.</p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-3">
              <p class="font-medium text-text-primary">Weekly</p>
              <p class="mt-1">{{ weekDays[form.weeklyDayOfWeek] }} alle {{ formatHour(form.weeklyHourUtc) }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-3">
              <p class="font-medium text-text-primary">Monthly</p>
              <p class="mt-1">Giorno {{ form.monthlyDayOfMonth }} alle {{ formatHour(form.monthlyHourUtc) }}</p>
            </div>
          </div>
        </div>
      </div>

      <form class="card space-y-8" @submit.prevent="saveSettings">
        <section>
          <h2 class="text-lg font-semibold text-text-primary">Pianificazione invii</h2>
          <p class="mt-1 text-sm text-text-secondary">
            Tutti gli orari sono salvati in UTC per mantenere stabile il comportamento del motore.
          </p>
          <p class="mt-2 text-sm text-text-secondary">
            La frequenza Immediate non usa finestre orarie: ogni nuova pubblicazione alimenta subito la pipeline.
          </p>

          <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label class="label">Immediate - ora UTC (legacy)</label>
              <input v-model.number="form.immediateHourUtc" type="number" min="0" max="23" class="input-field" disabled />
            </div>
            <div>
              <label class="label">Weekly - giorno</label>
              <select v-model.number="form.weeklyDayOfWeek" class="input-field">
                <option v-for="(day, index) in weekDays" :key="day" :value="index">
                  {{ day }}
                </option>
              </select>
            </div>
            <div>
              <label class="label">Weekly - ora UTC</label>
              <input v-model.number="form.weeklyHourUtc" type="number" min="0" max="23" class="input-field" />
            </div>
            <div>
              <label class="label">Monthly - giorno</label>
              <input v-model.number="form.monthlyDayOfMonth" type="number" min="1" max="28" class="input-field" />
            </div>
            <div>
              <label class="label">Monthly - ora UTC</label>
              <input v-model.number="form.monthlyHourUtc" type="number" min="0" max="23" class="input-field" />
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-text-primary">Policy pipeline</h2>
          <p class="mt-1 text-sm text-text-secondary">
            Parametri della coda persistita: throughput, retry, timeout di lock e retention storica.
          </p>

          <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label class="label">Batch size</label>
              <input v-model.number="form.batchSize" type="number" min="1" max="100" class="input-field" />
            </div>
            <div>
              <label class="label">Tentativi massimi</label>
              <input v-model.number="form.maxAttempts" type="number" min="1" max="10" class="input-field" />
            </div>
            <div>
              <label class="label">Retry base min</label>
              <input v-model.number="form.retryBaseDelayMinutes" type="number" min="1" max="120" class="input-field" />
            </div>
            <div>
              <label class="label">Lock timeout min</label>
              <input v-model.number="form.lockTimeoutMinutes" type="number" min="1" max="120" class="input-field" />
            </div>
            <div>
              <label class="label">Retention giorni</label>
              <input v-model.number="form.retentionDays" type="number" min="1" max="365" class="input-field" />
            </div>
          </div>
        </section>

        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary" :disabled="loading">
            {{ loading ? 'Salvataggio...' : 'Salva impostazioni' }}
          </button>
          <router-link to="/settings/notifications/pipeline" class="btn-secondary">
            Vedi pipeline
          </router-link>
        </div>
      </form>
    </template>
  </div>
</template>
