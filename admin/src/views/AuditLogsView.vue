<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'

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
  ARTICLE_CREATED: 'Articolo creato',
  ARTICLE_UPDATED: 'Articolo aggiornato',
  ARTICLE_DELETED: 'Articolo eliminato',
  ARTICLE_STATUS_CHANGED: 'Stato articolo aggiornato',
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
  ARTICLE: 'Articolo',
  CATEGORY: 'Categoria',
  TAG: 'Tag',
  SETTINGS: 'Impostazioni',
}

const logs = ref<AuditLogItem[]>([])
const loading = ref(true)
const error = ref('')
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const summary = ref({ total: 0, failures: 0, successes: 0 })
const filterOptions = ref({
  actions: [] as string[],
  entityTypes: [] as string[],
  outcomes: [] as string[],
  actorRoles: [] as string[],
})

const filters = reactive({
  action: '',
  entityType: '',
  outcome: '',
  actorRole: '',
  dateFrom: '',
  dateTo: '',
  search: '',
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

async function fetchLogs(page = 1) {
  loading.value = true
  error.value = ''

  try {
    const { data } = await axios.get(`/api/admin/audit-logs?${buildQuery(page)}`)
    logs.value = data.data
    pagination.value = { ...pagination.value, ...data.pagination }
    summary.value = data.summary
    filterOptions.value = data.filters
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore nel caricamento dei log attività'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  fetchLogs(1)
}

function resetFilters() {
  filters.action = ''
  filters.entityType = ''
  filters.outcome = ''
  filters.actorRole = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.search = ''
  fetchLogs(1)
}

function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > pagination.value.totalPages) return
  fetchLogs(nextPage)
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

onMounted(() => {
  fetchLogs()
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

    <div class="table-container">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Quando</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Evento</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Attore</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Contesto</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Metadati</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Esito</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-8 text-center text-text-secondary">Caricamento...</td>
          </tr>
          <tr v-else-if="!logs.length">
            <td colspan="6" class="px-4 py-8 text-center text-text-secondary">Nessun evento trovato</td>
          </tr>
          <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50/50 align-top">
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
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between gap-4 mt-4" v-if="pagination.totalPages > 1">
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
  </div>
</template>
