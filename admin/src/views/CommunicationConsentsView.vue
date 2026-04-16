<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import AdminModal from '../components/AdminModal.vue'
import CommunicationSectionTabs from '../components/CommunicationSectionTabs.vue'
import PageHeader from '../components/PageHeader.vue'
import { getApiErrorMessage } from '../utils/apiMessages'
import { downloadCsv } from '../utils/csv'

type ConsentValue = 'YES' | 'NO'
type ConsentStatus = 'REGISTERED' | 'CONFIRMED'

type ConsentStats = {
  total: number
  accepted: number
  rejected: number
  pendingConfirmations: number
  byFormula: Array<{
    formulaId: string
    code: string
    title?: string | null
    total: number
    accepted: number
    rejected: number
  }>
}

type ConsentListItem = {
  id: string
  value: ConsentValue
  status: ConsentStatus
  source: string
  createdAt: string
  contact: {
    id: string
    email: string
  }
  consentFormula: {
    id: string
    code: string
  }
  consentFormulaVersion: {
    versionNumber: number
    title?: string | null
  }
}

const loadingStats = ref(true)
const loadingList = ref(true)
const exporting = ref(false)
const submitting = ref(false)
const error = ref('')
const success = ref('')
const stats = ref<ConsentStats>({
  total: 0,
  accepted: 0,
  rejected: 0,
  pendingConfirmations: 0,
  byFormula: [],
})
const items = ref<ConsentListItem[]>([])
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const filters = ref({
  search: '',
  formulaId: '',
  value: '',
  status: '',
})
const dialogOpen = ref(false)
const registerLookupLoading = ref(false)
const registerLookupDone = ref(false)
const registerFoundContact = ref(false)
const registerForm = ref({
  email: '',
  consents: {} as Record<string, ConsentValue>,
})

const acceptedPercent = computed(() => (
  stats.value.total ? Math.round((stats.value.accepted / stats.value.total) * 100) : 0
))
const rejectedPercent = computed(() => (
  stats.value.total ? Math.round((stats.value.rejected / stats.value.total) * 100) : 0
))

function formatDateTime(value: string | null) {
  if (!value) return 'n/d'
  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function getFormulaTitle(title: string | null | undefined, fallback: string) {
  return title || fallback
}

function resetMessages() {
  error.value = ''
  success.value = ''
}

function resetRegisterForm() {
  registerLookupDone.value = false
  registerFoundContact.value = false
  registerForm.value = {
    email: '',
    consents: Object.fromEntries(
      stats.value.byFormula.map((formula) => [formula.formulaId, formula.accepted > 0 ? 'YES' : 'NO']),
    ),
  }
}

async function fetchStats() {
  loadingStats.value = true

  try {
    const { data } = await axios.get('/api/admin/communications/consents/stats')
    stats.value = data
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento statistiche consensi fallito')
  } finally {
    loadingStats.value = false
  }
}

async function fetchList(page = pagination.value.page) {
  loadingList.value = true

  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pagination.value.limit),
    })

    if (filters.value.search.trim()) params.set('search', filters.value.search.trim())
    if (filters.value.formulaId) params.set('formulaId', filters.value.formulaId)
    if (filters.value.value) params.set('value', filters.value.value)
    if (filters.value.status) params.set('status', filters.value.status)

    const { data } = await axios.get(`/api/admin/communications/consents?${params.toString()}`)
    items.value = Array.isArray(data.items) ? data.items : []
    pagination.value = {
      page: data.page ?? page,
      limit: data.limit ?? pagination.value.limit,
      total: data.total ?? 0,
      totalPages: Math.max(1, Math.ceil((data.total ?? 0) / (data.limit ?? pagination.value.limit))),
    }
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento elenco consensi fallito')
  } finally {
    loadingList.value = false
  }
}

async function lookupRegisterEmail() {
  if (!registerForm.value.email.trim()) {
    error.value = 'Inserisci un indirizzo email'
    return
  }

  registerLookupLoading.value = true
  error.value = ''

  try {
    const { data } = await axios.get(`/api/admin/communications/contacts/lookup?email=${encodeURIComponent(registerForm.value.email.trim())}`)
    registerLookupDone.value = true
    registerFoundContact.value = Boolean(data.found)

    if (data.found && Array.isArray(data.consents)) {
      for (const consent of data.consents) {
        registerForm.value.consents[consent.formulaId] = consent.value
      }
    }
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Lookup contatto fallito')
  } finally {
    registerLookupLoading.value = false
  }
}

async function submitRegister() {
  if (!registerForm.value.email.trim()) {
    error.value = 'Inserisci un indirizzo email'
    return
  }

  submitting.value = true
  resetMessages()

  try {
    await axios.post('/api/admin/communications/consents/register', {
      email: registerForm.value.email.trim(),
      consents: stats.value.byFormula.map((formula) => ({
        formulaId: formula.formulaId,
        value: registerForm.value.consents[formula.formulaId] ?? 'NO',
      })),
    })

    success.value = 'Consensi registrati'
    dialogOpen.value = false
    await Promise.all([fetchStats(), fetchList(1)])
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Registrazione consensi fallita')
  } finally {
    submitting.value = false
  }
}

async function exportCsv() {
  exporting.value = true
  resetMessages()

  try {
    const rows: Array<Array<unknown>> = [[
      'Data',
      'Contatto',
      'Formula',
      'Versione',
      'Valore',
      'Stato',
      'Origine',
    ]]

    const totalPages = Math.max(1, Math.ceil(pagination.value.total / 100))
    for (let page = 1; page <= totalPages; page += 1) {
      const params = new URLSearchParams({
        page: String(page),
        limit: '100',
      })
      if (filters.value.search.trim()) params.set('search', filters.value.search.trim())
      if (filters.value.formulaId) params.set('formulaId', filters.value.formulaId)
      if (filters.value.value) params.set('value', filters.value.value)
      if (filters.value.status) params.set('status', filters.value.status)

      const { data } = await axios.get(`/api/admin/communications/consents?${params.toString()}`)
      for (const item of data.items ?? []) {
        rows.push([
          formatDateTime(item.createdAt),
          item.contact?.email ?? '',
          getFormulaTitle(item.consentFormulaVersion?.title, item.consentFormula?.code ?? 'Formula'),
          item.consentFormulaVersion?.versionNumber ?? '',
          item.value,
          item.status,
          item.source,
        ])
      }
    }

    downloadCsv('mindcalm-consensi-comunicazione.csv', rows)
    success.value = 'CSV consensi esportato'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Export consensi fallito')
  } finally {
    exporting.value = false
  }
}

let filterTimer: number | undefined
watch(filters, () => {
  window.clearTimeout(filterTimer)
  filterTimer = window.setTimeout(() => {
    void fetchList(1)
  }, 250)
}, { deep: true })

watch(dialogOpen, (open) => {
  if (open) {
    resetRegisterForm()
  }
})

onMounted(async () => {
  await Promise.all([fetchStats(), fetchList()])
  resetRegisterForm()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Consensi comunicazione"
      description="Dashboard operativa con statistiche, filtri e registrazione manuale dei consensi."
    >
      <template #actions>
        <button type="button" class="btn-secondary" :disabled="exporting" @click="exportCsv">
          {{ exporting ? 'Export...' : 'Esporta CSV' }}
        </button>
        <button type="button" class="btn-primary" @click="dialogOpen = true">
          Registra consenso
        </button>
      </template>
    </PageHeader>

    <CommunicationSectionTabs />

    <div v-if="error" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
      {{ error }}
    </div>
    <div v-if="success" class="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {{ success }}
    </div>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article class="card p-5">
        <p class="text-sm text-text-secondary">Totale consensi</p>
        <p class="mt-2 text-3xl font-semibold text-text-primary">{{ loadingStats ? '…' : stats.total }}</p>
      </article>
      <article class="card p-5">
        <p class="text-sm text-text-secondary">Accettati</p>
        <p class="mt-2 text-3xl font-semibold text-emerald-700">{{ loadingStats ? '…' : `${acceptedPercent}%` }}</p>
      </article>
      <article class="card p-5">
        <p class="text-sm text-text-secondary">Rifiutati</p>
        <p class="mt-2 text-3xl font-semibold text-red-600">{{ loadingStats ? '…' : `${rejectedPercent}%` }}</p>
      </article>
      <article class="card p-5">
        <p class="text-sm text-text-secondary">Conferme pendenti</p>
        <p class="mt-2 text-3xl font-semibold text-amber-600">{{ loadingStats ? '…' : stats.pendingConfirmations }}</p>
      </article>
    </section>

    <section class="card">
      <div class="grid gap-4 xl:grid-cols-4">
        <div>
          <label class="label">Cerca contatto</label>
          <input v-model="filters.search" type="text" class="input-field" placeholder="Cerca per email" />
        </div>
        <div>
          <label class="label">Formula</label>
          <select v-model="filters.formulaId" class="input-field">
            <option value="">Tutte</option>
            <option v-for="formula in stats.byFormula" :key="formula.formulaId" :value="formula.formulaId">
              {{ getFormulaTitle(formula.title, formula.code) }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">Valore</label>
          <select v-model="filters.value" class="input-field">
            <option value="">Tutti</option>
            <option value="YES">YES</option>
            <option value="NO">NO</option>
          </select>
        </div>
        <div>
          <label class="label">Stato</label>
          <select v-model="filters.status" class="input-field">
            <option value="">Tutti</option>
            <option value="REGISTERED">REGISTERED</option>
            <option value="CONFIRMED">CONFIRMED</option>
          </select>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.4fr),minmax(320px,0.8fr)]">
      <div class="table-container bg-white">
        <table class="w-full min-w-[860px]">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Data</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Contatto</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Formula</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Valore</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Stato</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Origine</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loadingList">
              <td colspan="6" class="px-4 py-8 text-center text-sm text-text-secondary">Caricamento consensi...</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="6" class="px-4 py-8 text-center text-sm text-text-secondary">Nessun consenso trovato.</td>
            </tr>
            <tr v-for="item in items" :key="item.id" class="hover:bg-gray-50/70">
              <td class="px-4 py-4 text-sm text-text-secondary">{{ formatDateTime(item.createdAt) }}</td>
              <td class="px-4 py-4 text-sm font-medium text-text-primary">{{ item.contact.email }}</td>
              <td class="px-4 py-4 text-sm text-text-primary">
                {{ getFormulaTitle(item.consentFormulaVersion.title, item.consentFormula.code) }}
                <span class="mt-1 block text-xs text-text-secondary">v{{ item.consentFormulaVersion.versionNumber }}</span>
              </td>
              <td class="px-4 py-4">
                <span :class="[
                  'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                  item.value === 'YES' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
                ]">
                  {{ item.value }}
                </span>
              </td>
              <td class="px-4 py-4">
                <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {{ item.status }}
                </span>
              </td>
              <td class="px-4 py-4 text-sm text-text-secondary">{{ item.source }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <aside class="card">
        <h2 class="text-lg font-semibold text-text-primary">Breakdown per formula</h2>
        <p class="mt-1 text-sm text-text-secondary">Distribuzione dei consensi attivi per ciascuna formula.</p>

        <div v-if="loadingStats" class="mt-5 text-sm text-text-secondary">Caricamento breakdown...</div>
        <div v-else class="mt-5 space-y-3">
          <article
            v-for="formula in stats.byFormula"
            :key="formula.formulaId"
            class="rounded-2xl border border-ui-border px-4 py-4"
          >
            <p class="text-sm font-semibold text-text-primary">{{ getFormulaTitle(formula.title, formula.code) }}</p>
            <p class="mt-1 text-xs text-text-secondary">{{ formula.code }}</p>
            <div class="mt-4 flex flex-wrap gap-2 text-xs">
              <span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{{ formula.total }} totali</span>
              <span class="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">{{ formula.accepted }} YES</span>
              <span class="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">{{ formula.rejected }} NO</span>
            </div>
          </article>
        </div>
      </aside>
    </section>

    <div v-if="pagination.totalPages > 1" class="flex items-center justify-between gap-3">
      <p class="text-sm text-text-secondary">
        Pagina {{ pagination.page }} di {{ pagination.totalPages }}
      </p>
      <div class="flex gap-2">
        <button type="button" class="btn-secondary" :disabled="pagination.page <= 1 || loadingList" @click="fetchList(pagination.page - 1)">
          Precedente
        </button>
        <button type="button" class="btn-secondary" :disabled="pagination.page >= pagination.totalPages || loadingList" @click="fetchList(pagination.page + 1)">
          Successiva
        </button>
      </div>
    </div>

    <AdminModal :open="dialogOpen" panel-class="max-w-2xl" @close="dialogOpen = false">
      <div class="w-full rounded-[28px] bg-white p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-text-primary">Registra consenso</h2>
            <p class="mt-1 text-sm text-text-secondary">Lookup del contatto e aggiornamento manuale delle preferenze.</p>
          </div>
          <button type="button" class="btn-secondary" @click="dialogOpen = false">Chiudi</button>
        </div>

        <div class="mt-6 space-y-5">
          <div>
            <label class="label">Email</label>
            <div class="flex gap-3">
              <input v-model="registerForm.email" type="email" class="input-field" placeholder="utente@example.com" />
              <button type="button" class="btn-secondary whitespace-nowrap" :disabled="registerLookupLoading" @click="lookupRegisterEmail">
                {{ registerLookupLoading ? 'Lookup...' : 'Verifica' }}
              </button>
            </div>
            <p v-if="registerLookupDone" class="mt-2 text-sm" :class="registerFoundContact ? 'text-emerald-700' : 'text-sky-700'">
              {{ registerFoundContact ? 'Contatto esistente trovato' : 'Nuovo contatto: verrà creato al salvataggio' }}
            </p>
          </div>

          <div class="space-y-3">
            <div
              v-for="formula in stats.byFormula"
              :key="formula.formulaId"
              class="rounded-2xl border border-ui-border px-4 py-4"
            >
              <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p class="text-sm font-semibold text-text-primary">{{ getFormulaTitle(formula.title, formula.code) }}</p>
                  <p class="mt-1 text-xs text-text-secondary">{{ formula.code }}</p>
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    :class="[
                      'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      registerForm.consents[formula.formulaId] === 'YES'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700',
                    ]"
                    @click="registerForm.consents[formula.formulaId] = 'YES'"
                  >
                    Sì
                  </button>
                  <button
                    type="button"
                    :class="[
                      'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      registerForm.consents[formula.formulaId] === 'NO'
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-100 text-slate-700',
                    ]"
                    @click="registerForm.consents[formula.formulaId] = 'NO'"
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3">
            <button type="button" class="btn-secondary" @click="dialogOpen = false">Annulla</button>
            <button type="button" class="btn-primary" :disabled="submitting || !stats.byFormula.length" @click="submitRegister">
              {{ submitting ? 'Salvataggio...' : 'Salva consensi' }}
            </button>
          </div>
        </div>
      </div>
    </AdminModal>
  </div>
</template>
