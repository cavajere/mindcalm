<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import { useAuthStore } from '../stores/authStore'

type BackupFrequency = 'DAILY' | 'WEEKLY'

type BackupSettings = {
  enabled: boolean
  frequency: BackupFrequency
  timeOfDay: string
  dayOfWeek: number
  retentionCount: number
  retentionDays: number | null
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
}

type LocalBackupFile = {
  fileName: string
  filePath: string
  size: number
  createdAt: string
  source: 'manual' | 'scheduled' | 'imported' | 'unknown'
}

type BackupOverview = {
  storagePath: string
  settings: BackupSettings
  runtime: {
    schedulerRunning: boolean
    jobRunning: boolean
  }
  files: LocalBackupFile[]
}

const auth = useAuthStore()
const router = useRouter()
const isDev = import.meta.env.DEV

const loading = ref(false)
const saving = ref(false)
const generating = ref(false)
const importing = ref(false)
const restoring = ref(false)
const success = ref('')
const error = ref('')
const overview = ref<BackupOverview | null>(null)
const selectedRestoreFileName = ref('')
const confirmationText = ref(isDev ? 'RIPRISTINA' : '')
const importFile = ref<File | null>(null)

const form = ref<BackupSettings>({
  enabled: false,
  frequency: 'DAILY',
  timeOfDay: '02:00',
  dayOfWeek: 1,
  retentionCount: 14,
  retentionDays: 30,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
})

const weekdayOptions = [
  { label: 'Domenica', value: 0 },
  { label: 'Lunedi', value: 1 },
  { label: 'Martedi', value: 2 },
  { label: 'Mercoledi', value: 3 },
  { label: 'Giovedi', value: 4 },
  { label: 'Venerdi', value: 5 },
  { label: 'Sabato', value: 6 },
]

const canRestore = computed(() =>
  Boolean(selectedRestoreFileName.value) &&
  confirmationText.value === 'RIPRISTINA' &&
  !restoring.value,
)

function resetMessages() {
  success.value = ''
  error.value = ''
}

function applyOverview(data: BackupOverview) {
  overview.value = data
  form.value = { ...data.settings }

  if (selectedRestoreFileName.value && !data.files.some((file) => file.fileName === selectedRestoreFileName.value)) {
    selectedRestoreFileName.value = ''
    confirmationText.value = isDev ? 'RIPRISTINA' : ''
  }
}

async function fetchOverview() {
  loading.value = true

  try {
    const { data } = await axios.get<BackupOverview>('/api/admin/settings/backup')
    applyOverview(data)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Caricamento configurazione backup fallito'
  } finally {
    loading.value = false
  }
}

function formatDateTime(value: string | null) {
  if (!value) return 'N/D'
  return new Date(value).toLocaleString('it-IT')
}

function formatSize(value: number) {
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

function sourceLabel(source: LocalBackupFile['source']) {
  if (source === 'scheduled') return 'Schedulato'
  if (source === 'manual') return 'Manuale'
  if (source === 'imported') return 'Importato'
  return 'Archivio'
}

async function saveSettings() {
  resetMessages()
  saving.value = true

  try {
    const payload = {
      enabled: form.value.enabled,
      frequency: form.value.frequency,
      timeOfDay: form.value.timeOfDay,
      dayOfWeek: form.value.dayOfWeek,
      retentionCount: form.value.retentionCount,
      retentionDays: form.value.retentionDays,
    }

    const { data } = await axios.put<BackupSettings>('/api/admin/settings/backup', payload)
    form.value = { ...data }
    success.value = 'Pianificazione backup salvata'
    await fetchOverview()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Salvataggio configurazione backup fallito'
  } finally {
    saving.value = false
  }
}

async function generateLocalBackup() {
  resetMessages()
  generating.value = true

  try {
    const { data } = await axios.post('/api/admin/settings/backup/generate')
    success.value = data.message || 'Backup locale creato'
    await fetchOverview()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Generazione backup locale fallita'
  } finally {
    generating.value = false
  }
}

function resolveDownloadFilename(contentDisposition?: string, fallback?: string) {
  const fileNameMatch = contentDisposition?.match(/filename="([^"]+)"/i)
  return fileNameMatch?.[1] || fallback || `mindcalm-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`
}

async function exportBackup(fileName: string) {
  resetMessages()

  try {
    const response = await axios.get('/api/admin/settings/backup/export', {
      params: { fileName },
      responseType: 'blob',
    })

    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/gzip',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = resolveDownloadFilename(response.headers['content-disposition'], fileName)
    link.click()
    URL.revokeObjectURL(url)

    success.value = `Backup esportato: ${fileName}`
  } catch {
    error.value = 'Esportazione backup fallita'
  }
}

function handleImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  importFile.value = input.files?.[0] || null
  resetMessages()
}

async function importBackup() {
  if (!importFile.value) {
    return
  }

  resetMessages()
  importing.value = true

  try {
    const formData = new FormData()
    formData.append('backupFile', importFile.value)

    const { data } = await axios.post('/api/admin/settings/backup/import', formData)
    success.value = data.message || 'Backup importato'
    importFile.value = null
    await fetchOverview()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Import backup fallito'
  } finally {
    importing.value = false
  }
}

function selectRestoreFile(fileName: string) {
  selectedRestoreFileName.value = fileName
  confirmationText.value = isDev ? 'RIPRISTINA' : ''
  resetMessages()
}

async function restoreBackup() {
  if (!canRestore.value) {
    return
  }

  resetMessages()
  restoring.value = true

  try {
    const { data } = await axios.post('/api/admin/settings/backup/restore', {
      fileName: selectedRestoreFileName.value,
      confirmationText: confirmationText.value,
    })

    success.value = data.message || 'Ripristino completato'
    auth.clearSession()
    await router.push('/login')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Ripristino backup fallito'
  } finally {
    restoring.value = false
  }
}

onMounted(fetchOverview)
</script>

<template>
  <div class="mx-auto w-full max-w-6xl">
    <PageHeader
      title="Backup & Restore"
      description="Gestisci archivio backup locale, pianificazione automatica, rotazione, importazione, esportazione e ripristino totale."
    />

    <div v-if="success" class="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
      {{ success }}
    </div>
    <div v-if="error" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
      {{ error }}
    </div>

    <div v-if="loading && !overview" class="card text-sm text-text-secondary">
      Caricamento configurazione backup...
    </div>

    <template v-else-if="overview">
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section class="card space-y-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-semibold text-text-primary">Backup locale automatico</h2>
              <p class="mt-1 text-sm text-text-secondary">
                Ogni backup viene salvato prima in locale in <span class="font-mono text-xs">{{ overview.storagePath }}</span>.
              </p>
            </div>
            <button type="button" class="btn-primary whitespace-nowrap" :disabled="generating" @click="generateLocalBackup">
              {{ generating ? 'Generazione...' : 'Genera ora' }}
            </button>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p class="text-xs uppercase tracking-[0.2em] text-text-secondary">Scheduler</p>
              <p class="mt-2 text-sm font-medium text-text-primary">
                {{ overview.runtime.schedulerRunning ? 'Attivo nel backend' : 'Non avviato' }}
              </p>
              <p class="mt-1 text-xs text-text-secondary">
                {{ overview.runtime.jobRunning ? 'Backup schedulato in esecuzione' : 'Nessun job attivo' }}
              </p>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p class="text-xs uppercase tracking-[0.2em] text-text-secondary">Ultimo esito</p>
              <p class="mt-2 text-sm font-medium text-text-primary">{{ formatDateTime(form.lastSuccessAt) }}</p>
              <p class="mt-1 text-xs text-red-600" v-if="form.lastError">{{ form.lastError }}</p>
              <p class="mt-1 text-xs text-text-secondary" v-else>Ultimo tentativo: {{ formatDateTime(form.lastRunAt) }}</p>
            </div>
          </div>

          <form class="space-y-4" @submit.prevent="saveSettings">
            <label class="flex items-center gap-3 text-sm text-text-primary">
              <input v-model="form.enabled" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary/30" />
              Abilita backup schedulati locali
            </label>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label class="label">Frequenza</label>
                <select v-model="form.frequency" class="input-field">
                  <option value="DAILY">Giornaliera</option>
                  <option value="WEEKLY">Settimanale</option>
                </select>
              </div>

              <div>
                <label class="label">Ora</label>
                <input v-model="form.timeOfDay" type="time" class="input-field" />
              </div>

              <div v-if="form.frequency === 'WEEKLY'">
                <label class="label">Giorno</label>
                <select v-model.number="form.dayOfWeek" class="input-field">
                  <option v-for="option in weekdayOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label class="label">Mantieni ultimi N backup</label>
                <input v-model.number="form.retentionCount" type="number" min="1" class="input-field" />
              </div>

              <div>
                <label class="label">Elimina backup piu vecchi di N giorni</label>
                <input v-model.number="form.retentionDays" type="number" min="1" class="input-field" placeholder="Es. 30" />
              </div>
            </div>

            <div class="flex items-center gap-3">
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? 'Salvataggio...' : 'Salva pianificazione' }}
              </button>
            </div>
          </form>
        </section>

        <section class="card space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-text-primary">Importazione e ripristino</h2>
            <p class="mt-1 text-sm text-text-secondary">
              Importa un file nell’archivio locale oppure ripristina un backup gia presente.
            </p>
          </div>

          <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            Il ripristino sostituisce integralmente database, impostazioni e file caricati. Al termine la sessione admin viene chiusa.
          </div>

          <div class="space-y-3">
            <div>
              <label class="label">Importa backup nell’archivio locale</label>
              <input
                type="file"
                accept=".json,.gz,.json.gz,application/json,application/gzip"
                class="input-field file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                @change="handleImportFileChange"
              />
            </div>

            <div class="flex items-center gap-3">
              <button type="button" class="btn-secondary" :disabled="!importFile || importing" @click="importBackup">
                {{ importing ? 'Importazione...' : 'Importa backup' }}
              </button>
            </div>
          </div>

          <div class="space-y-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
            <div>
              <p class="text-sm font-medium text-red-800">Ripristino totale</p>
              <p class="mt-1 text-xs text-red-700">
                Backup selezionato: {{ selectedRestoreFileName || 'nessuno' }}
              </p>
            </div>

            <div>
              <label class="label">Conferma distruttiva</label>
              <input
                v-model="confirmationText"
                type="text"
                class="input-field"
                placeholder="Digita RIPRISTINA"
              />
            </div>

            <button type="button" class="btn-danger" :disabled="!canRestore" @click="restoreBackup">
              {{ restoring ? 'Ripristino...' : 'Ripristina backup selezionato' }}
            </button>
          </div>
        </section>
      </div>

      <section class="card mt-6 space-y-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-text-primary">Archivio backup locali</h2>
            <p class="mt-1 text-sm text-text-secondary">
              Elenco dei backup disponibili sul server per esportazione o ripristino.
            </p>
          </div>
          <button type="button" class="btn-secondary" @click="fetchOverview">
            Aggiorna elenco
          </button>
        </div>

        <div v-if="!overview.files.length" class="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-text-secondary">
          Nessun backup locale presente.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="file in overview.files"
            :key="file.fileName"
            class="flex flex-col gap-4 rounded-2xl border border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="truncate text-sm font-medium text-text-primary">{{ file.fileName }}</p>
                <span class="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-text-secondary">
                  {{ sourceLabel(file.source) }}
                </span>
              </div>
              <p class="mt-1 text-xs text-text-secondary">
                Creato il {{ formatDateTime(file.createdAt) }} · {{ formatSize(file.size) }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="btn-secondary" @click="exportBackup(file.fileName)">
                Esporta
              </button>
              <button
                type="button"
                class="btn-secondary"
                :class="selectedRestoreFileName === file.fileName ? '!border-red-300 !text-red-700' : ''"
                @click="selectRestoreFile(file.fileName)"
              >
                {{ selectedRestoreFileName === file.fileName ? 'Selezionato' : 'Seleziona per restore' }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
