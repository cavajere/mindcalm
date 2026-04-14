<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import AlbumImagePicker from '../components/AlbumImagePicker.vue'
import AdminModal from '../components/AdminModal.vue'
import CommunicationSectionTabs from '../components/CommunicationSectionTabs.vue'
import PageHeader from '../components/PageHeader.vue'
import TiptapEditor from '../components/TiptapEditor.vue'
import type { AlbumImage } from '../types/album'
import { getApiErrorMessage } from '../utils/apiMessages'
import { getPublicAppUrl } from '../utils/appUrls'

type MatchMode = 'ALL' | 'ANY'
type CampaignStatus = 'DRAFT' | 'SENT' | 'CANCELLED'

type FormulaTranslation = {
  lang: string
  title: string
}

type AudienceFormulaVersion = {
  id: string
  versionNumber: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  translations: FormulaTranslation[]
}

type AudienceFormula = {
  id: string
  code: string
  required: boolean
  currentVersionId: string | null
  versions: AudienceFormulaVersion[]
}

type AudienceOptionsResponse = {
  matchModes: MatchMode[]
  placeholders: string[]
  formulas: AudienceFormula[]
}

type PreviewContact = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
}

type SearchContact = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  activeConsents: Array<{
    id: string
    code: string
    title: string
  }>
}

type CampaignHistoryItem = {
  id: string
  name: string
  subject: string
  htmlBody: string
  matchMode: MatchMode
  status: CampaignStatus
  sentAt: string | null
  createdAt: string
  recipientsCount: number
  pendingCount: number
  sentCount: number
  failedCount: number
  createdByUser: {
    name: string
    email: string
  } | null
  filters: Array<{
    id: string
    consentFormulaId: string
    formulaVersionIds: string[]
    consentFormula: {
      id: string
      code: string
    }
  }>
}

const publicBaseUrl = getPublicAppUrl()

const loading = ref(true)
const previewing = ref(false)
const sending = ref(false)
const searchingContacts = ref(false)
const error = ref('')
const success = ref('')
const activeTab = ref<'compose' | 'history'>('compose')
const previewModalOpen = ref(false)
const options = ref<AudienceOptionsResponse | null>(null)
const previewContacts = ref<PreviewContact[]>([])
const previewTotal = ref(0)
const historyItems = ref<CampaignHistoryItem[]>([])
const selectedHistoryId = ref('')
const lastPreviewSignature = ref('')
const recipientSearch = ref('')
const manualSearchQuery = ref('')
const manualSearchResults = ref<SearchContact[]>([])
const manualRecipients = ref<SearchContact[]>([])
const selectedRecipientIds = ref<string[]>([])
const selectedAlbumImage = ref<AlbumImage | null>(null)

const form = ref({
  name: '',
  subject: '',
  htmlBody: [
    '<p>Ciao,</p>',
    '<p>ti scriviamo da MindCalm per condividere una comunicazione importante.</p>',
    '<p>Puoi gestire le tue preferenze dal link {{unsubscribe_url}}.</p>',
  ].join(''),
  unsubscribeLabel: 'Gestisci preferenze comunicazione',
  matchMode: 'ALL' as MatchMode,
  filters: [] as Array<{ formulaId: string; versionIds: string[] }>,
})

const selectedHistoryItem = computed(() => (
  historyItems.value.find((item) => item.id === selectedHistoryId.value) ?? historyItems.value[0] ?? null
))

const selectedFormulaCount = computed(() => form.value.filters.length)
const selectedAudienceCount = computed(() => selectedRecipientIds.value.length)
const hasAudienceFilters = computed(() => form.value.filters.length > 0)
const filteredPreviewRecipients = computed(() => {
  const query = recipientSearch.value.trim().toLowerCase()
  if (!query) return previewContacts.value

  return previewContacts.value.filter((recipient) => recipient.email.toLowerCase().includes(query))
})
const currentAudienceSignature = computed(() => JSON.stringify({
  matchMode: form.value.matchMode,
  filters: [...form.value.filters]
    .map((filter) => ({
      formulaId: filter.formulaId,
      versionIds: [...filter.versionIds].sort(),
    }))
    .sort((left, right) => left.formulaId.localeCompare(right.formulaId)),
}))
const previewIsCurrent = computed(() => (
  !hasAudienceFilters.value || (lastPreviewSignature.value !== '' && lastPreviewSignature.value === currentAudienceSignature.value)
))
const canSend = computed(() => (
  form.value.name.trim().length > 0
  && form.value.subject.trim().length > 0
  && form.value.htmlBody.trim().length > 0
  && (hasAudienceFilters.value || manualRecipients.value.length > 0)
))

function getContactDisplayName(contact: { firstName?: string | null; lastName?: string | null }) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim()
}

function resetMessages() {
  error.value = ''
  success.value = ''
}

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

function getVersionTitle(version: AudienceFormulaVersion) {
  return version.translations.find((translation) => translation.lang === 'it')?.title
    || version.translations[0]?.title
    || `Versione ${version.versionNumber}`
}

function getHistoryStatusBadge(status: CampaignStatus) {
  if (status === 'SENT') return 'bg-emerald-100 text-emerald-700'
  if (status === 'CANCELLED') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

function getFilter(formulaId: string) {
  return form.value.filters.find((filter) => filter.formulaId === formulaId) ?? null
}

function isFormulaSelected(formulaId: string) {
  return Boolean(getFilter(formulaId))
}

function isVersionSelected(formulaId: string, versionId: string) {
  return getFilter(formulaId)?.versionIds.includes(versionId) ?? false
}

function toggleFormula(formulaId: string) {
  const existingIndex = form.value.filters.findIndex((filter) => filter.formulaId === formulaId)
  if (existingIndex >= 0) {
    form.value.filters.splice(existingIndex, 1)
    return
  }

  form.value.filters.push({ formulaId, versionIds: [] })
}

function toggleVersion(formulaId: string, versionId: string) {
  const existing = getFilter(formulaId)
  if (!existing) {
    form.value.filters.push({ formulaId, versionIds: [versionId] })
    return
  }

  if (existing.versionIds.includes(versionId)) {
    existing.versionIds = existing.versionIds.filter((entry) => entry !== versionId)
    return
  }

  existing.versionIds = [...existing.versionIds, versionId]
}

function getCampaignFormulaSummary(campaign: CampaignHistoryItem) {
  if (!campaign.filters.length) return 'Audience manuale'

  return campaign.filters.map((filter) => {
    const formula = options.value?.formulas.find((entry) => entry.id === filter.consentFormulaId)
    return formula ? getFormulaTitle(formula) : filter.consentFormula.code
  }).join(' · ')
}

async function fetchAudienceOptions() {
  const { data } = await axios.get<AudienceOptionsResponse>('/api/campaigns/audience-options')
  options.value = data

  if (!data.matchModes.includes(form.value.matchMode)) {
    form.value.matchMode = data.matchModes[0] ?? 'ALL'
  }
}

async function fetchHistory() {
  const { data } = await axios.get('/api/campaigns?limit=50')
  historyItems.value = Array.isArray(data.data) ? data.data : []
  selectedHistoryId.value = historyItems.value[0]?.id ?? ''
}

async function previewAudience() {
  if (!hasAudienceFilters.value) {
    previewContacts.value = []
    previewTotal.value = 0
    selectedRecipientIds.value = []
    lastPreviewSignature.value = ''
    return true
  }

  previewing.value = true
  resetMessages()

  try {
    const { data } = await axios.post('/api/campaigns/audience-preview', {
      filters: form.value.filters,
      matchMode: form.value.matchMode,
    })

    previewContacts.value = Array.isArray(data.contacts) ? data.contacts : []
    previewTotal.value = data.total ?? previewContacts.value.length
    selectedRecipientIds.value = previewContacts.value.map((recipient) => recipient.id)
    lastPreviewSignature.value = currentAudienceSignature.value
    return true
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Anteprima audience fallita')
    return false
  } finally {
    previewing.value = false
  }
}

function selectAllVisibleRecipients() {
  const visibleIds = filteredPreviewRecipients.value.map((recipient) => recipient.id)
  selectedRecipientIds.value = [...new Set([...selectedRecipientIds.value, ...visibleIds])]
}

function clearVisibleRecipients() {
  const visibleIds = new Set(filteredPreviewRecipients.value.map((recipient) => recipient.id))
  selectedRecipientIds.value = selectedRecipientIds.value.filter((recipientId) => !visibleIds.has(recipientId))
}

async function searchManualContacts() {
  if (manualSearchQuery.value.trim().length < 2) {
    manualSearchResults.value = []
    return
  }

  searchingContacts.value = true

  try {
    const filters = hasAudienceFilters.value ? JSON.stringify(form.value.filters) : ''
    const params = new URLSearchParams({
      q: manualSearchQuery.value.trim(),
      matchMode: form.value.matchMode,
    })
    if (filters) params.set('filters', filters)

    const { data } = await axios.get(`/api/campaigns/search-contacts?${params.toString()}`)
    const currentIds = new Set(manualRecipients.value.map((recipient) => recipient.id))
    manualSearchResults.value = (Array.isArray(data) ? data : []).filter((recipient) => !currentIds.has(recipient.id))
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Ricerca contatti fallita')
  } finally {
    searchingContacts.value = false
  }
}

function addManualRecipient(contact: SearchContact) {
  if (manualRecipients.value.some((recipient) => recipient.id === contact.id)) return
  manualRecipients.value = [...manualRecipients.value, contact]
  manualSearchQuery.value = ''
  manualSearchResults.value = []
}

function removeManualRecipient(contactId: string) {
  manualRecipients.value = manualRecipients.value.filter((recipient) => recipient.id !== contactId)
}

function resolvePublicImageUrl(url: string | null) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/api/files/images/')) {
    return `${publicBaseUrl}${url.replace('/api/files/images/', '/public-api/images/')}`
  }
  return `${publicBaseUrl}${url.startsWith('/') ? url : `/${url}`}`
}

function insertSelectedImage() {
  const imageUrl = resolvePublicImageUrl(selectedAlbumImage.value?.url ?? null)
  if (!imageUrl) {
    error.value = 'Seleziona prima un’immagine album'
    return
  }

  form.value.htmlBody = `${form.value.htmlBody}<p><img src="${imageUrl}" alt="" /></p>`
  success.value = 'Immagine inserita nel contenuto'
}

function insertPlaceholder(placeholder: string) {
  form.value.htmlBody = `${form.value.htmlBody}<p>${placeholder}</p>`
}

async function sendCampaign() {
  if (!canSend.value) {
    error.value = 'Completa nome, oggetto, contenuto e destinatari'
    return
  }

  if (hasAudienceFilters.value && !previewIsCurrent.value) {
    const previewSucceeded = await previewAudience()
    if (!previewSucceeded) {
      return
    }
  }

  sending.value = true
  resetMessages()

  try {
    const { data } = await axios.post('/api/campaigns/send', {
      name: form.value.name.trim(),
      subject: form.value.subject.trim(),
      htmlBody: form.value.htmlBody,
      filters: form.value.filters,
      matchMode: form.value.matchMode,
      selectedRecipientIds: hasAudienceFilters.value ? selectedRecipientIds.value : [],
      manualRecipientIds: manualRecipients.value.map((recipient) => recipient.id),
      unsubscribeLabel: form.value.unsubscribeLabel.trim() || undefined,
    })

    success.value = `Campagna inviata a ${data.recipientsCount} destinatari`
    manualRecipients.value = []
    manualSearchResults.value = []
    manualSearchQuery.value = ''
    await Promise.all([fetchHistory(), previewAudience()])
    activeTab.value = 'history'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Invio campagna fallito')
  } finally {
    sending.value = false
  }
}

let manualSearchTimer: number | undefined
watch(manualSearchQuery, () => {
  window.clearTimeout(manualSearchTimer)
  manualSearchTimer = window.setTimeout(() => {
    void searchManualContacts()
  }, 250)
})

watch(
  () => currentAudienceSignature.value,
  () => {
    if (!hasAudienceFilters.value) {
      previewContacts.value = []
      previewTotal.value = 0
      selectedRecipientIds.value = []
      lastPreviewSignature.value = ''
      return
    }

    if (lastPreviewSignature.value && lastPreviewSignature.value !== currentAudienceSignature.value) {
      success.value = ''
    }
  },
)

onMounted(async () => {
  loading.value = true

  try {
    await Promise.all([fetchAudienceOptions(), fetchHistory()])
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento sezione campagne fallito')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Campagne comunicazione"
      description="Componi DEM, costruisci l’audience con i consensi e monitora lo storico degli invii."
    />

    <CommunicationSectionTabs />

    <div v-if="error" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
      {{ error }}
    </div>
    <div v-if="success" class="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {{ success }}
    </div>

    <div class="inline-flex rounded-2xl border border-ui-border bg-white p-2">
      <button
        type="button"
        :class="[
          'rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
          activeTab === 'compose' ? 'bg-slate-950 text-white' : 'text-text-secondary hover:bg-slate-100 hover:text-text-primary',
        ]"
        @click="activeTab = 'compose'"
      >
        Composer
      </button>
      <button
        type="button"
        :class="[
          'rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
          activeTab === 'history' ? 'bg-slate-950 text-white' : 'text-text-secondary hover:bg-slate-100 hover:text-text-primary',
        ]"
        @click="activeTab = 'history'"
      >
        Storico
      </button>
    </div>

    <template v-if="activeTab === 'compose'">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.1fr),minmax(340px,0.9fr)]">
        <section class="space-y-6">
          <article class="card">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 class="text-lg font-semibold text-text-primary">Audience</h2>
                <p class="mt-1 text-sm text-text-secondary">
                  Seleziona formule e versioni di consenso. Puoi poi restringere ai soli destinatari visibili.
                </p>
              </div>
              <div class="rounded-2xl bg-slate-100 px-4 py-3 text-sm">
                <p class="text-text-secondary">Modalità match</p>
                <div class="mt-2 inline-flex rounded-xl bg-white p-1">
                  <button
                    type="button"
                    :class="[
                      'rounded-lg px-3 py-2 text-sm font-medium',
                      form.matchMode === 'ALL' ? 'bg-slate-950 text-white' : 'text-text-secondary',
                    ]"
                    @click="form.matchMode = 'ALL'"
                  >
                    Tutte
                  </button>
                  <button
                    type="button"
                    :class="[
                      'rounded-lg px-3 py-2 text-sm font-medium',
                      form.matchMode === 'ANY' ? 'bg-slate-950 text-white' : 'text-text-secondary',
                    ]"
                    @click="form.matchMode = 'ANY'"
                  >
                    Almeno una
                  </button>
                </div>
              </div>
            </div>

            <div v-if="loading" class="mt-5 text-sm text-text-secondary">Caricamento formule audience...</div>
            <div v-else-if="!options?.formulas.length" class="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-700">
              Nessuna formula consenso pubblicata. Completa prima la configurazione in Impostazioni iscrizione.
            </div>
            <div v-else class="mt-5 space-y-3">
              <article
                v-for="formula in options.formulas"
                :key="formula.id"
                class="rounded-2xl border border-ui-border px-4 py-4"
              >
                <div class="flex flex-col gap-4">
                  <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-semibold text-text-primary">{{ getFormulaTitle(formula) }}</p>
                        <span v-if="formula.required" class="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          Obbligatorio
                        </span>
                      </div>
                      <p class="mt-1 text-xs text-text-secondary">{{ formula.code }}</p>
                    </div>

                    <button
                      type="button"
                      :class="[
                        'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        isFormulaSelected(formula.id) ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700',
                      ]"
                      @click="toggleFormula(formula.id)"
                    >
                      {{ isFormulaSelected(formula.id) ? 'Inclusa' : 'Includi formula' }}
                    </button>
                  </div>

                  <div v-if="isFormulaSelected(formula.id)" class="grid gap-2 md:grid-cols-2">
                    <button
                      v-for="version in formula.versions"
                      :key="version.id"
                      type="button"
                      :class="[
                        'rounded-2xl border px-3 py-3 text-left transition-colors',
                        isVersionSelected(formula.id, version.id)
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-ui-border bg-white text-text-primary hover:border-slate-300',
                      ]"
                      @click="toggleVersion(formula.id, version.id)"
                    >
                      <span class="block text-sm font-semibold">{{ getVersionTitle(version) }}</span>
                      <span class="mt-1 block text-xs opacity-80">v{{ version.versionNumber }} · {{ version.status }}</span>
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <div class="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" class="btn-primary" :disabled="previewing || !hasAudienceFilters" @click="previewAudience">
                {{ previewing ? 'Aggiornamento...' : 'Aggiorna destinatari' }}
              </button>
              <span class="text-sm text-text-secondary">
                {{ previewIsCurrent ? `${previewTotal} destinatari verificati` : 'Anteprima non aggiornata rispetto ai filtri correnti' }}
              </span>
            </div>

            <div v-if="previewContacts.length" class="mt-6 rounded-2xl border border-ui-border">
              <div class="flex flex-col gap-3 border-b border-ui-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p class="text-sm font-semibold text-text-primary">Anteprima destinatari</p>
                  <p class="mt-1 text-sm text-text-secondary">
                    {{ selectedAudienceCount }} selezionati su {{ previewTotal }}
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <input v-model="recipientSearch" type="text" class="input-field lg:w-64" placeholder="Cerca nella preview" />
                  <button type="button" class="btn-secondary" @click="selectAllVisibleRecipients">
                    Seleziona visibili
                  </button>
                  <button type="button" class="btn-secondary" @click="clearVisibleRecipients">
                    Deseleziona visibili
                  </button>
                </div>
              </div>

              <div class="max-h-[360px] overflow-y-auto px-4 py-4">
                <div v-if="!filteredPreviewRecipients.length" class="rounded-2xl border border-dashed border-ui-border px-4 py-8 text-center text-sm text-text-secondary">
                  Nessun destinatario visibile con questi filtri.
                </div>
                <label
                  v-for="recipient in filteredPreviewRecipients"
                  :key="recipient.id"
                  class="flex items-center gap-3 border-b border-gray-100 py-3 last:border-b-0"
                >
                  <input v-model="selectedRecipientIds" type="checkbox" :value="recipient.id" class="h-4 w-4 rounded border-ui-border" />
                  <span class="text-sm text-text-primary">{{ recipient.email }}</span>
                </label>
              </div>
            </div>
          </article>

          <article class="card">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 class="text-lg font-semibold text-text-primary">Contenuto DEM</h2>
                <p class="mt-1 text-sm text-text-secondary">
                  Oggetto, contenuto HTML e link preferenze sempre inclusi nel footer email.
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn-secondary" @click="previewModalOpen = true">Preview DEM</button>
                <button type="button" class="btn-primary" :disabled="sending || !canSend" @click="sendCampaign">
                  {{ sending ? 'Invio...' : 'Invia campagna' }}
                </button>
              </div>
            </div>

            <div class="mt-5 grid gap-5">
              <div>
                <label class="label">Nome comunicazione</label>
                <input v-model="form.name" type="text" class="input-field" placeholder="Newsletter aprile 2026" />
              </div>

              <div>
                <label class="label">Oggetto email</label>
                <input v-model="form.subject" type="text" class="input-field" placeholder="Oggetto visibile nella casella del destinatario" />
              </div>

              <div>
                <label class="label">Etichetta link preferenze</label>
                <input v-model="form.unsubscribeLabel" type="text" class="input-field" placeholder="Gestisci preferenze comunicazione" />
              </div>

              <div>
                <label class="label">Placeholder rapidi</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="placeholder in options?.placeholders ?? []"
                    :key="placeholder"
                    type="button"
                    class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    @click="insertPlaceholder(placeholder)"
                  >
                    {{ placeholder }}
                  </button>
                </div>
              </div>

              <div>
                <label class="label">Corpo HTML</label>
                <TiptapEditor v-model="form.htmlBody" placeholder="Scrivi il contenuto della comunicazione..." />
              </div>

              <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr),220px]">
                <AlbumImagePicker
                  :selected-image="selectedAlbumImage"
                  label="Immagine da album"
                  @select="selectedAlbumImage = $event"
                  @clear="selectedAlbumImage = null"
                />

                <div class="rounded-2xl border border-ui-border bg-slate-50 px-4 py-4">
                  <p class="text-sm font-semibold text-text-primary">Azioni contenuto</p>
                  <p class="mt-2 text-sm text-text-secondary">
                    L’immagine selezionata viene inserita nel corpo con URL pubblico.
                  </p>
                  <button type="button" class="btn-secondary mt-4 w-full" @click="insertSelectedImage">
                    Inserisci immagine
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>

        <aside class="space-y-6">
          <article class="card">
            <h2 class="text-lg font-semibold text-text-primary">Destinatari manuali</h2>
            <p class="mt-1 text-sm text-text-secondary">
              Aggiungi contatti singoli con consenso attivo, anche fuori dal subset selezionato.
            </p>

            <div class="mt-5 space-y-3">
              <input
                v-model="manualSearchQuery"
                type="text"
                class="input-field"
                placeholder="Cerca contatto per email, nome o cognome"
              />

              <div v-if="searchingContacts" class="text-sm text-text-secondary">Ricerca in corso...</div>

              <div v-if="manualSearchResults.length" class="space-y-2">
                <button
                  v-for="contact in manualSearchResults"
                  :key="contact.id"
                  type="button"
                  class="w-full rounded-2xl border border-ui-border px-4 py-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                  @click="addManualRecipient(contact)"
                >
                  <span v-if="getContactDisplayName(contact)" class="block text-sm font-semibold text-text-primary">{{ getContactDisplayName(contact) }}</span>
                  <span class="block text-sm" :class="getContactDisplayName(contact) ? 'text-text-secondary' : 'font-semibold text-text-primary'">{{ contact.email }}</span>
                  <span class="mt-1 block text-xs text-text-secondary">
                    {{ contact.activeConsents.map((consent) => consent.title).join(' · ') }}
                  </span>
                </button>
              </div>

              <div v-if="manualRecipients.length" class="space-y-2">
                <article
                  v-for="contact in manualRecipients"
                  :key="contact.id"
                  class="rounded-2xl border border-ui-border px-4 py-4"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p v-if="getContactDisplayName(contact)" class="truncate text-sm font-semibold text-text-primary">{{ getContactDisplayName(contact) }}</p>
                      <p class="truncate text-sm" :class="getContactDisplayName(contact) ? 'text-text-secondary' : 'font-semibold text-text-primary'">{{ contact.email }}</p>
                      <p class="mt-1 text-xs text-text-secondary">
                        {{ contact.activeConsents.map((consent) => consent.title).join(' · ') }}
                      </p>
                    </div>
                    <button type="button" class="text-sm font-medium text-red-600 hover:underline" @click="removeManualRecipient(contact.id)">
                      Rimuovi
                    </button>
                  </div>
                </article>
              </div>
            </div>
          </article>

          <article class="card">
            <h2 class="text-lg font-semibold text-text-primary">Controlli prima dell’invio</h2>
            <div class="mt-5 space-y-3">
              <div class="rounded-2xl bg-slate-100 px-4 py-4">
                <p class="text-sm text-text-secondary">Formule selezionate</p>
                <p class="mt-1 text-2xl font-semibold text-text-primary">{{ selectedFormulaCount }}</p>
              </div>
              <div class="rounded-2xl bg-slate-100 px-4 py-4">
                <p class="text-sm text-text-secondary">Destinatari preview selezionati</p>
                <p class="mt-1 text-2xl font-semibold text-text-primary">{{ selectedAudienceCount }}</p>
              </div>
              <div class="rounded-2xl bg-slate-100 px-4 py-4">
                <p class="text-sm text-text-secondary">Destinatari manuali</p>
                <p class="mt-1 text-2xl font-semibold text-text-primary">{{ manualRecipients.length }}</p>
              </div>
              <div :class="[
                'rounded-2xl px-4 py-4 text-sm',
                previewIsCurrent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
              ]">
                {{ previewIsCurrent ? 'Anteprima audience allineata ai filtri correnti.' : 'Riesegui l’anteprima prima di inviare.' }}
              </div>
            </div>
          </article>
        </aside>
      </div>
    </template>

    <template v-else>
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
        <section class="table-container bg-white">
          <table class="w-full min-w-[860px]">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Campagna</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Audience</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Destinatari</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Stato</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Inviata il</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="loading">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-text-secondary">Caricamento storico...</td>
              </tr>
              <tr v-else-if="!historyItems.length">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-text-secondary">Nessuna campagna registrata.</td>
              </tr>
              <tr
                v-for="campaign in historyItems"
                :key="campaign.id"
                class="cursor-pointer hover:bg-gray-50/70"
                :class="selectedHistoryItem?.id === campaign.id ? 'bg-slate-50' : ''"
                @click="selectedHistoryId = campaign.id"
              >
                <td class="px-4 py-4">
                  <p class="text-sm font-semibold text-text-primary">{{ campaign.name }}</p>
                  <p class="mt-1 text-xs text-text-secondary">{{ campaign.subject }}</p>
                </td>
                <td class="px-4 py-4 text-sm text-text-secondary">{{ getCampaignFormulaSummary(campaign) }}</td>
                <td class="px-4 py-4 text-sm text-text-secondary">{{ campaign.recipientsCount }}</td>
                <td class="px-4 py-4">
                  <span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', getHistoryStatusBadge(campaign.status)]">
                    {{ campaign.status }}
                  </span>
                </td>
                <td class="px-4 py-4 text-sm text-text-secondary">{{ formatDateTime(campaign.sentAt || campaign.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <aside class="card">
          <div v-if="selectedHistoryItem">
            <h2 class="text-lg font-semibold text-text-primary">{{ selectedHistoryItem.name }}</h2>
            <p class="mt-1 text-sm text-text-secondary">{{ selectedHistoryItem.subject }}</p>

            <div class="mt-5 space-y-3 text-sm">
              <div class="rounded-2xl bg-slate-100 px-4 py-4">
                <p class="text-text-secondary">Creata da</p>
                <p class="mt-1 font-medium text-text-primary">
                  {{ selectedHistoryItem.createdByUser?.name || selectedHistoryItem.createdByUser?.email || 'Sistema' }}
                </p>
              </div>
              <div class="rounded-2xl bg-slate-100 px-4 py-4">
                <p class="text-text-secondary">Match mode</p>
                <p class="mt-1 font-medium text-text-primary">{{ selectedHistoryItem.matchMode }}</p>
              </div>
              <div class="rounded-2xl bg-slate-100 px-4 py-4">
                <p class="text-text-secondary">Destinatari</p>
                <div class="mt-2 flex flex-wrap gap-2 text-xs">
                  <span class="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700">{{ selectedHistoryItem.recipientsCount }} totali</span>
                  <span class="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">{{ selectedHistoryItem.sentCount }} inviati</span>
                  <span class="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">{{ selectedHistoryItem.failedCount }} errori</span>
                </div>
              </div>
              <div class="rounded-2xl border border-ui-border px-4 py-4">
                <p class="text-sm font-medium text-text-primary">Audience</p>
                <p class="mt-2 text-sm text-text-secondary">{{ getCampaignFormulaSummary(selectedHistoryItem) }}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </template>

    <AdminModal :open="previewModalOpen" panel-class="max-w-4xl" @close="previewModalOpen = false">
      <div class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-ui-border px-6 py-5">
          <div>
            <h2 class="text-xl font-semibold text-text-primary">Preview DEM</h2>
            <p class="mt-1 text-sm text-text-secondary">
              Anteprima del contenuto con placeholder unsubscribe ancora visibile.
            </p>
          </div>
          <button type="button" class="btn-secondary" @click="previewModalOpen = false">Chiudi</button>
        </div>

        <div class="overflow-y-auto px-6 py-6">
          <article class="rounded-2xl border border-ui-border bg-white p-6">
            <h3 class="text-lg font-semibold text-text-primary">{{ form.subject || 'Oggetto email' }}</h3>
            <div class="prose mt-4 max-w-none" v-html="form.htmlBody" />
          </article>
        </div>
      </div>
    </AdminModal>
  </div>
</template>
