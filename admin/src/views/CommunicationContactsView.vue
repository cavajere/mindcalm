<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import AdminModal from '../components/AdminModal.vue'
import CommunicationSectionTabs from '../components/CommunicationSectionTabs.vue'
import PageHeader from '../components/PageHeader.vue'
import { getApiErrorMessage } from '../utils/apiMessages'
import { downloadCsv } from '../utils/csv'

type ContactStatus = 'ACTIVE' | 'SUPPRESSED'
type ConsentValue = 'YES' | 'NO'

type AudienceFormulaVersion = {
  id: string
  versionNumber: number
  translations: Array<{
    lang: string
    title: string
  }>
}

type AudienceFormula = {
  id: string
  code: string
  required: boolean
  currentVersionId: string | null
  versions: AudienceFormulaVersion[]
}

type AudienceOptionsResponse = {
  formulas: AudienceFormula[]
}

type ContactListItem = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  status: ContactStatus
  suppressedAt: string | null
  suppressionReason: string | null
  createdAt: string
  consentCounts: {
    accepted: number
    rejected: number
  }
}

const router = useRouter()

const loading = ref(true)
const submitting = ref(false)
const importing = ref(false)
const exporting = ref(false)
const error = ref('')
const success = ref('')
const searchQuery = ref('')
const contacts = ref<ContactListItem[]>([])
const formulas = ref<AudienceFormula[]>([])
const pagination = ref({ page: 1, limit: 25, total: 0, totalPages: 0 })
const addDialogOpen = ref(false)
const importInputRef = ref<HTMLInputElement | null>(null)
const importSummary = ref('')

const addForm = ref({
  email: '',
  firstName: '',
  lastName: '',
  consents: {} as Record<string, ConsentValue>,
})

const activeFormulas = computed(() => formulas.value.filter((formula) => formula.currentVersionId))

function formatDateTime(value: string | null) {
  if (!value) return 'n/d'

  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function getFormulaTitle(formula: AudienceFormula) {
  const currentVersion = formula.versions.find((version) => version.id === formula.currentVersionId) ?? formula.versions[0]
  return currentVersion?.translations.find((translation) => translation.lang === 'it')?.title
    || currentVersion?.translations[0]?.title
    || formula.code
}

function getStatusBadge(status: ContactStatus) {
  return status === 'SUPPRESSED'
    ? 'bg-red-100 text-red-700'
    : 'bg-emerald-100 text-emerald-700'
}

function getContactDisplayName(contact: Pick<ContactListItem, 'firstName' | 'lastName'>) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim()
}

function resetMessages() {
  error.value = ''
  success.value = ''
  importSummary.value = ''
}

function resetAddForm() {
  addForm.value = {
    email: '',
    firstName: '',
    lastName: '',
    consents: Object.fromEntries(
      activeFormulas.value.map((formula) => [formula.id, formula.required ? 'YES' : 'NO']),
    ),
  }
}

async function fetchFormulas() {
  const { data } = await axios.get<AudienceOptionsResponse>('/api/campaigns/audience-options')
  formulas.value = Array.isArray(data.formulas) ? data.formulas : []
}

async function fetchContacts(page = pagination.value.page) {
  loading.value = true

  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pagination.value.limit),
    })

    if (searchQuery.value.trim()) {
      params.set('search', searchQuery.value.trim())
    }

    const { data } = await axios.get(`/api/admin/communications/contacts?${params.toString()}`)
    contacts.value = Array.isArray(data.data) ? data.data : []
    pagination.value = data.pagination ?? pagination.value
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento contatti fallito')
  } finally {
    loading.value = false
  }
}

function openAddDialog() {
  resetMessages()
  resetAddForm()
  addDialogOpen.value = true
}

async function submitAdd() {
  if (!addForm.value.email.trim()) {
    error.value = 'Inserisci un indirizzo email'
    return
  }

  submitting.value = true
  resetMessages()

  try {
    await axios.post('/api/admin/communications/contacts', {
      email: addForm.value.email.trim(),
      firstName: addForm.value.firstName.trim() || undefined,
      lastName: addForm.value.lastName.trim() || undefined,
      consents: activeFormulas.value.map((formula) => ({
        formulaId: formula.id,
        value: addForm.value.consents[formula.id] ?? 'NO',
      })),
    })

    success.value = 'Contatto salvato'
    addDialogOpen.value = false
    await fetchContacts(1)
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Salvataggio contatto fallito')
  } finally {
    submitting.value = false
  }
}

async function deleteContact(contact: ContactListItem) {
  if (!window.confirm(`Eliminare il contatto ${contact.email}?`)) return

  resetMessages()

  try {
    await axios.delete(`/api/admin/communications/contacts/${contact.id}`)
    success.value = 'Contatto eliminato'
    await fetchContacts()
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Eliminazione contatto fallita')
  }
}

async function exportContacts() {
  exporting.value = true
  resetMessages()

  try {
    const rows: Array<Array<unknown>> = [[
      'Email',
      'Nome',
      'Cognome',
      'Stato',
      'Consensi YES',
      'Consensi NO',
      'Creato il',
      'Soppresso il',
      'Motivo soppressione',
    ]]

    const totalPages = Math.max(1, Math.ceil(pagination.value.total / 100))
    for (let page = 1; page <= totalPages; page += 1) {
      const params = new URLSearchParams({
        page: String(page),
        limit: '100',
      })
      if (searchQuery.value.trim()) params.set('search', searchQuery.value.trim())

      const { data } = await axios.get(`/api/admin/communications/contacts?${params.toString()}`)
      for (const contact of data.data ?? []) {
        rows.push([
          contact.email,
          contact.firstName ?? '',
          contact.lastName ?? '',
          contact.status,
          contact.consentCounts?.accepted ?? 0,
          contact.consentCounts?.rejected ?? 0,
          formatDateTime(contact.createdAt),
          formatDateTime(contact.suppressedAt),
          contact.suppressionReason ?? '',
        ])
      }
    }

    downloadCsv('mindcalm-contatti-comunicazione.csv', rows)
    success.value = 'CSV contatti esportato'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Export contatti fallito')
  } finally {
    exporting.value = false
  }
}

function downloadTemplate() {
  downloadCsv('template-contatti-comunicazione.csv', [
    ['email', 'firstName', 'lastName'],
    ['utente@example.com', 'Mario', 'Rossi'],
  ])
}

function parseCsvContacts(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [email, firstName = '', lastName = ''] = line.split(/[;,]/).map((value) => value.trim())
      return { email, firstName, lastName }
    })
    .filter((row) => row.email && row.email.toLowerCase() !== 'email')
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importing.value = true
  resetMessages()

  try {
    const contactsToImport = parseCsvContacts(await file.text())
    if (!contactsToImport.length) {
      throw new Error('Nessun indirizzo email valido trovato nel file')
    }

    let imported = 0
    let failed = 0

    for (const contact of contactsToImport) {
      try {
        await axios.post('/api/admin/communications/contacts', {
          email: contact.email,
          firstName: contact.firstName || undefined,
          lastName: contact.lastName || undefined,
          consents: activeFormulas.value.map((formula) => ({
            formulaId: formula.id,
            value: formula.required ? 'YES' : 'NO',
          })),
        })
        imported += 1
      } catch {
        failed += 1
      }
    }

    importSummary.value = `Import completato: ${imported} contatti salvati, ${failed} scartati.`
    success.value = 'Import contatti completato'
    await fetchContacts(1)
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Import contatti fallito')
  } finally {
    importing.value = false
    input.value = ''
  }
}

let searchTimer: number | undefined
watch(searchQuery, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    void fetchContacts(1)
  }, 250)
})

watch(activeFormulas, () => {
  if (!addDialogOpen.value) return
  resetAddForm()
})

onMounted(async () => {
  try {
    await fetchFormulas()
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento formule consenso fallito')
  }

  resetAddForm()
  await fetchContacts()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Contatti comunicazione"
      description="Gestisci i destinatari, importa indirizzi e apri lo storico completo dei consensi."
    >
      <template #actions>
        <button type="button" class="btn-secondary" :disabled="exporting" @click="exportContacts">
          {{ exporting ? 'Export...' : 'Esporta CSV' }}
        </button>
        <button type="button" class="btn-secondary" @click="downloadTemplate">
          Template CSV
        </button>
        <button type="button" class="btn-secondary" :disabled="importing" @click="importInputRef?.click()">
          {{ importing ? 'Import...' : 'Importa CSV' }}
        </button>
        <button type="button" class="btn-primary" @click="openAddDialog">
          Nuovo contatto
        </button>
      </template>
    </PageHeader>

    <CommunicationSectionTabs />

    <input ref="importInputRef" type="file" accept=".csv,text/csv,.txt" class="hidden" @change="handleImportFile" />

    <div v-if="error" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
      {{ error }}
    </div>
    <div v-if="success" class="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {{ success }}
    </div>
    <div v-if="importSummary" class="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
      {{ importSummary }}
    </div>

    <section class="card">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr),220px] lg:items-end">
        <div>
          <label class="label">Cerca</label>
          <input v-model="searchQuery" type="text" class="input-field" placeholder="Cerca per email, nome o cognome" />
        </div>
        <div class="rounded-2xl bg-slate-100 px-4 py-3">
          <p class="text-sm text-text-secondary">Totale contatti</p>
          <p class="mt-1 text-2xl font-semibold text-text-primary">{{ pagination.total.toLocaleString('it-IT') }}</p>
        </div>
      </div>
    </section>

    <div class="table-container bg-white">
      <table class="w-full min-w-[760px]">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Contatto</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Stato</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Consensi</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Creato</th>
            <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-text-secondary">Azioni</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-8 text-center text-sm text-text-secondary">Caricamento contatti...</td>
          </tr>
          <tr v-else-if="!contacts.length">
            <td colspan="5" class="px-4 py-8 text-center text-sm text-text-secondary">Nessun contatto disponibile.</td>
          </tr>
          <tr v-for="contact in contacts" :key="contact.id" class="hover:bg-gray-50/70">
            <td class="px-4 py-4">
              <button
                type="button"
                class="text-left"
                @click="router.push(`/communications/contacts/${contact.id}`)"
              >
                <span v-if="getContactDisplayName(contact)" class="block text-sm font-semibold text-text-primary hover:text-primary">
                  {{ getContactDisplayName(contact) }}
                </span>
                <span class="block text-sm" :class="getContactDisplayName(contact) ? 'text-text-secondary' : 'font-semibold text-text-primary hover:text-primary'">
                  {{ contact.email }}
                </span>
                <span v-if="contact.suppressionReason" class="mt-1 block text-xs text-text-secondary">
                  {{ contact.suppressionReason }}
                </span>
              </button>
            </td>
            <td class="px-4 py-4">
              <span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', getStatusBadge(contact.status)]">
                {{ contact.status === 'SUPPRESSED' ? 'Soppresso' : 'Attivo' }}
              </span>
            </td>
            <td class="px-4 py-4 text-sm text-text-secondary">
              <span class="font-medium text-emerald-700">{{ contact.consentCounts.accepted }}</span>
              /
              <span class="font-medium text-red-600">{{ contact.consentCounts.rejected }}</span>
            </td>
            <td class="px-4 py-4 text-sm text-text-secondary">{{ formatDateTime(contact.createdAt) }}</td>
            <td class="px-4 py-4">
              <div class="flex items-center justify-center gap-2">
                <button type="button" class="btn-secondary px-3 py-1.5" @click="router.push(`/communications/contacts/${contact.id}`)">
                  Apri
                </button>
                <button type="button" class="btn-secondary px-3 py-1.5 text-red-600" @click="deleteContact(contact)">
                  Elimina
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pagination.totalPages > 1" class="flex items-center justify-between gap-3">
      <p class="text-sm text-text-secondary">
        Pagina {{ pagination.page }} di {{ pagination.totalPages }}
      </p>
      <div class="flex gap-2">
        <button type="button" class="btn-secondary" :disabled="pagination.page <= 1 || loading" @click="fetchContacts(pagination.page - 1)">
          Precedente
        </button>
        <button type="button" class="btn-secondary" :disabled="pagination.page >= pagination.totalPages || loading" @click="fetchContacts(pagination.page + 1)">
          Successiva
        </button>
      </div>
    </div>

    <AdminModal :open="addDialogOpen" panel-class="max-w-2xl" @close="addDialogOpen = false">
      <div class="w-full rounded-[28px] bg-white p-6 shadow-2xl">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold text-text-primary">Nuovo contatto</h2>
              <p class="mt-1 text-sm text-text-secondary">Inserimento manuale con anagrafica minima e consensi opzionali.</p>
            </div>
            <button type="button" class="btn-secondary" @click="addDialogOpen = false">Chiudi</button>
          </div>

          <div class="mt-6 space-y-5">
            <div>
              <label class="label">Email</label>
              <input v-model="addForm.email" type="email" class="input-field" placeholder="utente@example.com" />
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="label">Nome</label>
                <input v-model="addForm.firstName" type="text" class="input-field" placeholder="Mario" />
              </div>
              <div>
                <label class="label">Cognome</label>
                <input v-model="addForm.lastName" type="text" class="input-field" placeholder="Rossi" />
              </div>
            </div>

            <div>
              <p class="label">Consensi</p>
              <div v-if="!activeFormulas.length" class="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Nessuna formula consenso pubblicata. Il contatto può comunque essere creato e completato in seguito.
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="formula in activeFormulas"
                  :key="formula.id"
                  class="rounded-2xl border border-ui-border px-4 py-4"
                >
                  <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p class="text-sm font-semibold text-text-primary">{{ getFormulaTitle(formula) }}</p>
                      <p class="mt-1 text-xs text-text-secondary">{{ formula.code }}</p>
                    </div>

                    <div class="flex gap-2">
                      <button
                        type="button"
                        :class="[
                          'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                          addForm.consents[formula.id] === 'YES'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700',
                        ]"
                        @click="addForm.consents[formula.id] = 'YES'"
                      >
                        Sì
                      </button>
                      <button
                        type="button"
                        :disabled="formula.required"
                        :class="[
                          'rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                          addForm.consents[formula.id] === 'NO'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 text-slate-700',
                        ]"
                        @click="addForm.consents[formula.id] = 'NO'"
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-3">
              <button type="button" class="btn-secondary" @click="addDialogOpen = false">Annulla</button>
              <button type="button" class="btn-primary" :disabled="submitting" @click="submitAdd">
                {{ submitting ? 'Salvataggio...' : 'Salva contatto' }}
              </button>
            </div>
          </div>
      </div>
    </AdminModal>
  </div>
</template>
