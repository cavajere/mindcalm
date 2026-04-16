<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import { getApiErrorMessage } from '../utils/apiMessages'

interface AuditLogItem {
  id: string
  action: string
  entityType: string
  entityId: string | null
  entityLabel: string | null
  outcome: 'SUCCESS' | 'FAILURE'
  occurredAt: string
  actor: {
    userId: string | null
    email: string | null
    name: string | null
    role: 'ADMIN' | 'STANDARD' | null
  }
  request: {
    ipAddress: string | null
    userAgent: string | null
    path: string | null
    method: string | null
    requestId: string | null
  }
  metadata: Record<string, unknown> | unknown[] | string | number | boolean | null
}

type DeleteTarget = {
  mode: 'single' | 'selected' | 'all'
  log?: AuditLogItem
}

const actionLabels: Record<string, string> = {
  LOGIN_SUCCEEDED: 'Login riuscito',
  LOGIN_FAILED: 'Login fallito',
  LOGOUT: 'Logout',
  PASSWORD_RESET_REQUESTED: 'Reset password richiesto',
  PASSWORD_RESET_COMPLETED: 'Reset password completato',
  PASSWORD_CHANGED: 'Password cambiata',
  INVITE_SENT: 'Invito inviato',
  INVITE_ACCEPTED: 'Invito accettato',
  USER_CREATED: 'Utente creato',
  USER_UPDATED: 'Utente aggiornato',
  USER_DELETED: 'Utente eliminato',
  USER_INVITE_RESENT: 'Invito reinviato',
  INVITE_CODE_CREATED: 'Codice invito creato',
  INVITE_CODE_DISABLED: 'Codice invito disabilitato',
  INVITE_CODE_REDEEMED: 'Codice invito riscattato',
  REGISTRATION_STARTED: 'Registrazione avviata',
  REGISTRATION_VERIFICATION_SENT: 'Verifica registrazione inviata',
  REGISTRATION_VERIFIED: 'Registrazione confermata',
  REGISTRATION_FAILED: 'Registrazione fallita',
  AUDIO_CREATED: 'Audio creato',
  AUDIO_UPDATED: 'Audio aggiornato',
  AUDIO_DELETED: 'Audio eliminato',
  AUDIO_STATUS_CHANGED: 'Stato audio aggiornato',
  POST_CREATED: 'Post creato',
  POST_UPDATED: 'Post aggiornato',
  POST_DELETED: 'Post eliminato',
  POST_STATUS_CHANGED: 'Stato post aggiornato',
  EVENT_CREATED: 'Evento creato',
  EVENT_UPDATED: 'Evento aggiornato',
  EVENT_DELETED: 'Evento eliminato',
  EVENT_STATUS_CHANGED: 'Stato evento aggiornato',
  EVENT_BOOKING_CREATED: 'Prenotazione evento creata',
  EVENT_BOOKING_CANCELLED: 'Prenotazione evento annullata',
  EVENT_BOOKING_RESTORED: 'Prenotazione evento ripristinata',
  EVENT_BOOKING_RECONCILED: 'Capienza evento riallineata',
  CATEGORY_CREATED: 'Categoria creata',
  CATEGORY_UPDATED: 'Categoria aggiornata',
  CATEGORY_DELETED: 'Categoria eliminata',
  CATEGORY_ORDER_UPDATED: 'Ordine categorie aggiornato',
  TAG_CREATED: 'Tag creato',
  TAG_UPDATED: 'Tag aggiornato',
  TAG_DELETED: 'Tag eliminato',
  TAG_STATUS_CHANGED: 'Stato tag aggiornato',
  SMTP_SETTINGS_UPDATED: 'SMTP aggiornato',
  SMTP_TEST_SENT: 'Email test inviata',
}

const entityLabels: Record<string, string> = {
  AUTH: 'Autenticazione',
  USER: 'Utente',
  INVITE_CODE: 'Codice invito',
  REGISTRATION: 'Registrazione',
  AUDIO: 'Audio',
  POST: 'Post',
  EVENT: 'Evento',
  CATEGORY: 'Categoria',
  TAG: 'Tag',
  SETTINGS: 'Impostazioni',
}

const logs = ref<AuditLogItem[]>([])
const loading = ref(true)
const deleting = ref(false)
const error = ref('')
const success = ref('')
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const summary = ref({ total: 0, failures: 0, successes: 0, overallTotal: 0 })
const filterOptions = ref({
  actions: [] as string[],
  entityTypes: [] as string[],
  outcomes: [] as string[],
  actorRoles: [] as string[],
})
const selectedLogIds = ref<string[]>([])
const confirmDeleteOpen = ref(false)
const deleteTarget = ref<DeleteTarget | null>(null)

const filters = reactive({
  action: '',
  entityType: '',
  outcome: '',
  actorRole: '',
  dateFrom: '',
  dateTo: '',
  search: '',
})

const selectedCount = computed(() => selectedLogIds.value.length)
const allVisibleSelected = computed(() => (
  logs.value.length > 0 && logs.value.every((log) => selectedLogIds.value.includes(log.id))
))

const deleteDialogTitle = computed(() => {
  if (!deleteTarget.value) return 'Elimina log'
  if (deleteTarget.value.mode === 'single') return 'Elimina log'
  if (deleteTarget.value.mode === 'selected') return 'Elimina log selezionati'
  return 'Elimina tutti i log'
})

const deleteDialogMessage = computed(() => {
  if (!deleteTarget.value) {
    return 'Questa azione non può essere annullata.'
  }

  if (deleteTarget.value.mode === 'single' && deleteTarget.value.log) {
    return `Vuoi eliminare il log del ${formatDateTime(deleteTarget.value.log.occurredAt)} relativo a “${formatAction(deleteTarget.value.log.action)}”? Questa azione non può essere annullata.`
  }

  if (deleteTarget.value.mode === 'selected') {
    return `Vuoi eliminare ${selectedCount.value} log selezionati nella pagina corrente? Questa azione non può essere annullata.`
  }

  return `Vuoi eliminare definitivamente tutti i ${summary.value.overallTotal.toLocaleString('it-IT')} log presenti in archivio? Questa azione non può essere annullata.`
})

const deleteDialogConfirmLabel = computed(() => {
  if (deleteTarget.value?.mode === 'all') return 'Elimina tutto'
  return 'Elimina'
})

function buildQuery(page = 1) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pagination.value.limit),
  })

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value)
    }
  })

  return params.toString()
}

function clearFeedback() {
  error.value = ''
  success.value = ''
}

async function fetchLogs(page = 1) {
  loading.value = true
  error.value = ''

  try {
    const { data } = await axios.get(`/api/admin/audit-logs?${buildQuery(page)}`)
    logs.value = data.data
    pagination.value = { ...pagination.value, ...data.pagination }
    summary.value = data.summary
    filterOptions.value = data.filters

    const visibleIds = new Set(logs.value.map((log) => log.id))
    selectedLogIds.value = selectedLogIds.value.filter((id) => visibleIds.has(id))
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Errore nel caricamento dei log attività')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  clearFeedback()
  selectedLogIds.value = []
  void fetchLogs(1)
}

function resetFilters() {
  filters.action = ''
  filters.entityType = ''
  filters.outcome = ''
  filters.actorRole = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.search = ''
  clearFeedback()
  selectedLogIds.value = []
  void fetchLogs(1)
}

function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > pagination.value.totalPages) return
  void fetchLogs(nextPage)
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

function formatRole(role: string | null) {
  if (role === 'ADMIN') return 'Admin'
  if (role === 'STANDARD') return 'Standard'
  return 'Sistema'
}

function formatAction(action: string) {
  return actionLabels[action] || action.replaceAll('_', ' ')
}

function formatEntity(entityType: string) {
  return entityLabels[entityType] || entityType
}

function prettifyKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^./, (char) => char.toUpperCase())
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'n/d'
  if (Array.isArray(value)) return value.map((entry) => String(entry)).slice(0, 3).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatMetadata(metadata: AuditLogItem['metadata']) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return metadata ? String(metadata) : 'Nessun metadato'
  }

  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 4)

  if (!entries.length) {
    return 'Nessun metadato'
  }

  return entries
    .map(([key, value]) => `${prettifyKey(key)}: ${formatMetadataValue(value)}`)
    .join(' · ')
}

function formatRequest(log: AuditLogItem) {
  const parts = [
    log.request.method,
    log.request.path,
    log.request.ipAddress ? `IP ${log.request.ipAddress}` : null,
  ].filter((part): part is string => Boolean(part))

  return parts.join(' · ') || 'Contesto richiesta non disponibile'
}

function toggleSelectVisible(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  selectedLogIds.value = checked ? logs.value.map((log) => log.id) : []
}

function openSingleDelete(log: AuditLogItem) {
  deleteTarget.value = { mode: 'single', log }
  confirmDeleteOpen.value = true
}

function openSelectedDelete() {
  if (!selectedCount.value) return
  deleteTarget.value = { mode: 'selected' }
  confirmDeleteOpen.value = true
}

function openDeleteAll() {
  if (!summary.value.overallTotal) return
  deleteTarget.value = { mode: 'all' }
  confirmDeleteOpen.value = true
}

function closeDeleteDialog() {
  confirmDeleteOpen.value = false
  deleteTarget.value = null
}

function getRefreshPageAfterDeletion(mode: DeleteTarget['mode'], deletedCount: number) {
  if (mode === 'all') return 1

  const remainingRows = Math.max(0, logs.value.length - deletedCount)
  if (!remainingRows && pagination.value.page > 1) {
    return pagination.value.page - 1
  }

  return pagination.value.page
}

async function confirmDelete() {
  if (!deleteTarget.value || deleting.value) return

  const currentTarget = deleteTarget.value
  deleting.value = true
  clearFeedback()

  try {
    let responseData: { message?: string; deletedCount?: number }

    if (currentTarget.mode === 'single' && currentTarget.log) {
      const { data } = await axios.delete(`/api/admin/audit-logs/${currentTarget.log.id}`)
      responseData = data
    } else if (currentTarget.mode === 'selected') {
      const { data } = await axios.post('/api/admin/audit-logs/bulk-delete', {
        ids: selectedLogIds.value,
      })
      responseData = data
    } else {
      const { data } = await axios.delete('/api/admin/audit-logs')
      responseData = data
    }

    selectedLogIds.value = []
    closeDeleteDialog()
    await fetchLogs(getRefreshPageAfterDeletion(currentTarget.mode, responseData.deletedCount ?? 0))
    success.value = responseData.message || 'Operazione completata'
  } catch (apiError) {
    const fallback = currentTarget.mode === 'all'
      ? 'Eliminazione completa dei log fallita'
      : currentTarget.mode === 'selected'
        ? 'Eliminazione log selezionati fallita'
        : 'Eliminazione log fallita'

    error.value = getApiErrorMessage(apiError, fallback)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void fetchLogs()
})
</script>

<template>
  <div>
    <PageHeader
      title="Log attività"
      description="Audit trail di autenticazione, operazioni admin e modifiche sensibili."
    />

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="card">
        <p class="text-sm text-text-secondary mb-1">Eventi filtrati</p>
        <p class="text-3xl font-bold text-text-primary">{{ summary.total }}</p>
        <p class="mt-2 text-xs text-text-secondary">
          Archivio complessivo: {{ summary.overallTotal.toLocaleString('it-IT') }}
        </p>
      </div>
      <div class="card">
        <p class="text-sm text-text-secondary mb-1">Operazioni riuscite</p>
        <p class="text-3xl font-bold text-green-700">{{ summary.successes }}</p>
      </div>
      <div class="card">
        <p class="text-sm text-text-secondary mb-1">Operazioni fallite</p>
        <p class="text-3xl font-bold text-red-600">{{ summary.failures }}</p>
      </div>
    </div>

    <div class="card mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div>
          <label class="label">Cerca</label>
          <input
            v-model="filters.search"
            class="input-field"
            placeholder="Email, nome, path, IP"
            @keydown.enter.prevent="applyFilters"
          />
        </div>

        <div>
          <label class="label">Azione</label>
          <select v-model="filters.action" class="input-field">
            <option value="">Tutte</option>
            <option v-for="action in filterOptions.actions" :key="action" :value="action">
              {{ formatAction(action) }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Entità</label>
          <select v-model="filters.entityType" class="input-field">
            <option value="">Tutte</option>
            <option v-for="entityType in filterOptions.entityTypes" :key="entityType" :value="entityType">
              {{ formatEntity(entityType) }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Esito</label>
          <select v-model="filters.outcome" class="input-field">
            <option value="">Tutti</option>
            <option v-for="outcome in filterOptions.outcomes" :key="outcome" :value="outcome">
              {{ outcome === 'SUCCESS' ? 'Successo' : 'Errore' }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Ruolo attore</label>
          <select v-model="filters.actorRole" class="input-field">
            <option value="">Tutti</option>
            <option v-for="role in filterOptions.actorRoles" :key="role" :value="role">
              {{ formatRole(role) }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Dal</label>
          <input v-model="filters.dateFrom" type="date" class="input-field" />
        </div>

        <div>
          <label class="label">Al</label>
          <input v-model="filters.dateTo" type="date" class="input-field" />
        </div>

        <div class="flex items-end gap-3">
          <button class="btn-primary" @click="applyFilters">Applica</button>
          <button class="btn-secondary" @click="resetFilters">Reset</button>
        </div>
      </div>
    </div>

    <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
      {{ error }}
    </div>
    <div v-if="success" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-6">
      {{ success }}
    </div>

    <div class="card mb-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-sm text-text-secondary">Selezione pagina corrente</p>
          <p class="mt-1 text-lg font-semibold text-text-primary">
            {{ selectedCount }} log selezionati
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <button class="btn-secondary" :disabled="!selectedCount" @click="selectedLogIds = []">
            Annulla selezione
          </button>
          <button class="btn-danger" :disabled="deleting || !selectedCount" @click="openSelectedDelete">
            Elimina selezionati
          </button>
          <button class="btn-danger" :disabled="deleting || !summary.overallTotal" @click="openDeleteAll">
            Elimina tutti i log
          </button>
        </div>
      </div>
    </div>

    <div class="table-container">
      <table class="w-full min-w-[1100px]">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                :checked="allVisibleSelected"
                :disabled="loading || !logs.length"
                aria-label="Seleziona tutti i log visibili"
                @change="toggleSelectVisible"
              />
            </th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Quando</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Evento</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Attore</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Contesto</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Metadati</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Esito</th>
            <th class="table-actions-header px-4 py-3 text-xs font-medium text-text-secondary uppercase">Azioni</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-if="loading">
            <td colspan="8" class="px-4 py-8 text-center text-text-secondary">Caricamento...</td>
          </tr>
          <tr v-else-if="!logs.length">
            <td colspan="8" class="px-4 py-8 text-center text-text-secondary">Nessun evento trovato</td>
          </tr>
          <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50/50 align-top">
            <td class="px-4 py-3 text-center">
              <input
                v-model="selectedLogIds"
                type="checkbox"
                :value="log.id"
                class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                :aria-label="`Seleziona log ${formatAction(log.action)}`"
              />
            </td>
            <td class="px-4 py-3 text-sm text-text-primary whitespace-nowrap">
              {{ formatDateTime(log.occurredAt) }}
            </td>
            <td class="px-4 py-3 text-sm">
              <p class="font-medium text-text-primary">{{ formatAction(log.action) }}</p>
              <p class="text-xs text-text-secondary mt-1">
                {{ formatEntity(log.entityType) }}
                <span v-if="log.entityLabel">· {{ log.entityLabel }}</span>
              </p>
            </td>
            <td class="px-4 py-3 text-sm">
              <p class="font-medium text-text-primary">{{ log.actor.name || 'Sistema' }}</p>
              <p class="text-xs text-text-secondary mt-1">
                {{ log.actor.email || 'n/d' }} · {{ formatRole(log.actor.role) }}
              </p>
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary max-w-md">
              {{ formatRequest(log) }}
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary max-w-md">
              {{ formatMetadata(log.metadata) }}
            </td>
            <td class="px-4 py-3 text-sm">
              <span
                :class="[
                  'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                  log.outcome === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                ]"
              >
                {{ log.outcome === 'SUCCESS' ? 'Successo' : 'Errore' }}
              </span>
            </td>
            <td class="table-actions-cell">
              <div class="table-actions-group">
                <button
                  type="button"
                  class="icon-action-button icon-action-button-danger"
                  title="Elimina log"
                  aria-label="Elimina log"
                  @click="openSingleDelete(log)"
                >
                  <svg class="w-4 h-4 text-red-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pagination.totalPages > 1" class="flex items-center justify-between gap-4 mt-4">
      <p class="text-sm text-text-secondary">
        Pagina {{ pagination.page }} di {{ pagination.totalPages }} · {{ pagination.total }} eventi
      </p>

      <div class="flex items-center gap-2">
        <button class="btn-secondary" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">
          Precedente
        </button>
        <button class="btn-secondary" :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">
          Successiva
        </button>
      </div>
    </div>

    <ConfirmDialog
      :open="confirmDeleteOpen"
      :title="deleteDialogTitle"
      :message="deleteDialogMessage"
      :confirm-label="deleteDialogConfirmLabel"
      cancel-label="Annulla"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>
