<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import TiptapEditor from '../components/TiptapEditor.vue'
import { getApiErrorMessage } from '../utils/apiMessages'

type MatchMode = 'ALL' | 'ANY'
type CampaignStatus = 'DRAFT' | 'SENT' | 'CANCELLED'

type FormulaTranslation = {
  lang: string
  title: string
  text: string
}

type AudienceFormulaVersion = {
  id: string
  versionNumber: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  subscriptionPolicyVersionId: string
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
  status: 'ACTIVE' | 'SUPPRESSED'
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
  createdByUser: {
    id: string
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
  recipientsCount: number
  pendingCount: number
  sentCount: number
  failedCount: number
}

type AudiencePreviewResponse = {
  total: number
  contacts: PreviewContact[]
}

const loading = ref(true)
const refreshing = ref(false)
const previewing = ref(false)
const sending = ref(false)
const error = ref('')
const success = ref('')

const options = ref<AudienceOptionsResponse | null>(null)
const previewContacts = ref<PreviewContact[]>([])
const previewTotal = ref(0)
const historyItems = ref<CampaignHistoryItem[]>([])
const selectedCampaignId = ref('')
const lastPreviewSignature = ref('')

const form = ref({
  name: '',
  subject: '',
  htmlBody: [
    '<p>Ciao,</p>',
    '<p>ti scriviamo da MindCalm per condividere un aggiornamento importante.</p>',
    '<p>Puoi gestire le preferenze dal link {{unsubscribe_url}}.</p>',
  ].join(''),
  matchMode: 'ALL' as MatchMode,
  filters: [] as Array<{ formulaId: string; versionIds: string[] }>,
})

const hasFormulas = computed(() => Boolean(options.value?.formulas.length))
const selectedFiltersCount = computed(() => form.value.filters.length)
const selectedVersionCount = computed(() => form.value.filters.reduce((total, filter) => total + filter.versionIds.length, 0))
const currentAudienceSignature = computed(() => JSON.stringify({
  matchMode: form.value.matchMode,
  filters: [...form.value.filters]
    .map((filter) => ({
      formulaId: filter.formulaId,
      versionIds: [...filter.versionIds].sort(),
    }))
    .sort((left, right) => left.formulaId.localeCompare(right.formulaId)),
}))
const previewIsCurrent = computed(() => lastPreviewSignature.value === currentAudienceSignature.value && lastPreviewSignature.value !== '')
const canPreview = computed(() => hasFormulas.value && selectedFiltersCount.value > 0)
const canSend = computed(() => (
  hasFormulas.value
  && selectedFiltersCount.value > 0
  && form.value.name.trim().length > 0
  && form.value.subject.trim().length > 0
  && form.value.htmlBody.trim().length > 0
))
const selectedCampaign = computed(() => (
  historyItems.value.find((item) => item.id === selectedCampaignId.value) ?? historyItems.value[0] ?? null
))
const historySummary = computed(() => ({
  total: historyItems.value.length,
  sent: historyItems.value.filter((item) => item.status === 'SENT').length,
  cancelled: historyItems.value.filter((item) => item.status === 'CANCELLED').length,
  failedRecipients: historyItems.value.reduce((total, item) => total + item.failedCount, 0),
}))
const readinessItems = computed(() => ([
  {
    label: 'Audience definita',
    ok: selectedFiltersCount.value > 0,
    detail: selectedFiltersCount.value
      ? `${selectedFiltersCount.value} formule selezionate`
      : 'Seleziona almeno una formula di consenso',
  },
  {
    label: 'Messaggio completo',
    ok: Boolean(form.value.name.trim() && form.value.subject.trim() && form.value.htmlBody.trim()),
    detail: form.value.name.trim() && form.value.subject.trim() && form.value.htmlBody.trim()
      ? 'Nome, oggetto e contenuto sono pronti'
      : 'Completa nome comunicazione, oggetto e contenuto',
  },
  {
    label: 'Anteprima aggiornata',
    ok: previewIsCurrent.value,
    detail: previewIsCurrent.value
      ? `${previewTotal.value.toLocaleString('it-IT')} destinatari verificati`
      : 'Riesegui l’anteprima se hai cambiato i filtri',
  },
]))

function resetMessages() {
  error.value = ''
  success.value = ''
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'N/D'
  }

  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function getFormulaTitle(formula: AudienceFormula) {
  const currentVersion = formula.versions.find((version) => version.id === formula.currentVersionId) ?? formula.versions[0]
  const translation = currentVersion?.translations.find((entry) => entry.lang === 'it') ?? currentVersion?.translations[0]
  return translation?.title || formula.code
}

function getVersionTitle(version: AudienceFormulaVersion) {
  const translation = version.translations.find((entry) => entry.lang === 'it') ?? version.translations[0]
  return translation?.title || `Versione ${version.versionNumber}`
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
  const index = form.value.filters.findIndex((filter) => filter.formulaId === formulaId)

  if (index >= 0) {
    form.value.filters.splice(index, 1)
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

function getMatchModeLabel(mode: MatchMode) {
  return mode === 'ANY' ? 'Almeno uno' : 'Tutte'
}

function getCampaignStatusLabel(status: CampaignStatus) {
  if (status === 'SENT') return 'Inviata'
  if (status === 'CANCELLED') return 'Annullata'
  return 'Bozza'
}

function getCampaignStatusClasses(status: CampaignStatus) {
  if (status === 'SENT') return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200'
  return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
}

function getFormulaBadgeText(item: CampaignHistoryItem) {
  if (!item.filters.length) {
    return 'Nessun filtro'
  }

  return item.filters.map((filter) => {
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
  const { data } = await axios.get<{ data: CampaignHistoryItem[] }>('/api/campaigns', {
    params: { limit: 20 },
  })

  historyItems.value = data.data

  if (!selectedCampaignId.value || !historyItems.value.some((item) => item.id === selectedCampaignId.value)) {
    selectedCampaignId.value = historyItems.value[0]?.id ?? ''
  }
}

async function fetchData(background = false) {
  resetMessages()

  if (background) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  try {
    await Promise.all([fetchAudienceOptions(), fetchHistory()])
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento sezione comunicazione fallito')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function requestAudiencePreview() {
  const { data } = await axios.post<AudiencePreviewResponse>('/api/campaigns/audience-preview', {
    filters: form.value.filters,
    matchMode: form.value.matchMode,
  })

  previewContacts.value = data.contacts
  previewTotal.value = data.total
  lastPreviewSignature.value = currentAudienceSignature.value

  return data
}

async function previewAudience() {
  resetMessages()
  previewing.value = true

  try {
    const data = await requestAudiencePreview()
    success.value = data.total
      ? `Audience aggiornata: ${data.total.toLocaleString('it-IT')} destinatari`
      : 'Nessun destinatario trovato con i filtri selezionati'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Anteprima destinatari non riuscita')
  } finally {
    previewing.value = false
  }
}

async function sendCommunication() {
  if (!canSend.value) {
    error.value = 'Completa i campi richiesti prima dell’invio'
    return
  }

  resetMessages()
  sending.value = true

  try {
    if (!previewIsCurrent.value) {
      await requestAudiencePreview()
    }

    const { data } = await axios.post<{
      recipientsCount: number
      sentCount: number
      failedCount: number
      campaign: { id: string; status: CampaignStatus }
    }>('/api/campaigns/send', {
      name: form.value.name,
      subject: form.value.subject,
      htmlBody: form.value.htmlBody,
      matchMode: form.value.matchMode,
      filters: form.value.filters,
    })

    await fetchHistory()
    selectedCampaignId.value = data.campaign.id

    if (data.sentCount === 0) {
      error.value = `Invio non riuscito: ${data.failedCount.toLocaleString('it-IT')} destinatari in errore`
    } else if (data.failedCount > 0) {
      success.value = `Comunicazione inviata a ${data.sentCount.toLocaleString('it-IT')} destinatari. ${data.failedCount.toLocaleString('it-IT')} invii non riusciti.`
    } else {
      success.value = `Comunicazione inviata a ${data.sentCount.toLocaleString('it-IT')} destinatari.`
    }
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Invio comunicazione non riuscito')
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div>
    <PageHeader
      title="Comunicazione"
      description="Area operativa per comporre email, definire l’audience con i consensi attivi e controllare subito lo storico degli invii."
    >
      <template #actions>
        <router-link to="/settings/legal/privacy" class="btn-secondary">
          Gestisci consensi
        </router-link>
        <button class="btn-secondary" :disabled="refreshing || loading" @click="fetchData(true)">
          {{ refreshing ? 'Aggiornamento...' : 'Aggiorna' }}
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ error }}
    </div>
    <div v-if="success" class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {{ success }}
    </div>

    <div v-if="loading && !options" class="card text-sm text-text-secondary">
      Caricamento sezione comunicazione...
    </div>

    <template v-else-if="options">
      <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="card">
          <p class="text-sm text-text-secondary">Formule selezionate</p>
          <p class="mt-2 text-3xl font-semibold text-text-primary">{{ selectedFiltersCount }}</p>
          <p class="mt-2 text-sm text-text-secondary">Criteri attivi per definire l’audience</p>
        </div>
        <div class="card">
          <p class="text-sm text-text-secondary">Versioni vincolate</p>
          <p class="mt-2 text-3xl font-semibold text-text-primary">{{ selectedVersionCount }}</p>
          <p class="mt-2 text-sm text-text-secondary">Se zero, viene usato tutto il consenso confermato</p>
        </div>
        <div class="card">
          <p class="text-sm text-text-secondary">Ultima audience</p>
          <p class="mt-2 text-3xl font-semibold text-text-primary">{{ previewTotal.toLocaleString('it-IT') }}</p>
          <p class="mt-2 text-sm text-text-secondary">
            {{ previewIsCurrent ? 'Anteprima aggiornata' : 'Anteprima da rigenerare' }}
          </p>
        </div>
        <div class="card">
          <p class="text-sm text-text-secondary">Storico invii</p>
          <p class="mt-2 text-3xl font-semibold text-text-primary">{{ historySummary.sent }}</p>
          <p class="mt-2 text-sm text-text-secondary">
            {{ historySummary.failedRecipients }} errori destinatario rilevati
          </p>
        </div>
      </div>

      <div v-if="!hasFormulas" class="card mb-6">
        <p class="text-lg font-semibold text-text-primary">Nessun consenso comunicazione disponibile</p>
        <p class="mt-2 text-sm leading-6 text-text-secondary">
          Prima di usare questa area devi configurare almeno una formula di consenso nella sezione privacy.
        </p>
        <div class="mt-5">
          <router-link to="/settings/legal/privacy" class="btn-primary">
            Apri Privacy & Consensi
          </router-link>
        </div>
      </div>

      <template v-else>
        <div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.45fr)_420px]">
          <div class="space-y-6">
            <section class="card">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p class="text-lg font-semibold text-text-primary">Composer</p>
                  <p class="mt-1 text-sm text-text-secondary">
                    Scrivi la comunicazione e usa il placeholder
                    <span class="font-mono text-text-primary"> {{ options.placeholders[0] }} </span>
                    per inserire automaticamente il link preferenze.
                  </p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-text-secondary">
                  Regola audience:
                  <span class="font-semibold text-text-primary">{{ getMatchModeLabel(form.matchMode) }}</span>
                </div>
              </div>

              <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label class="label">Nome comunicazione</label>
                  <input v-model="form.name" class="input-field" placeholder="Aggiornamento MindCalm aprile" />
                </div>
                <div>
                  <label class="label">Oggetto email</label>
                  <input v-model="form.subject" class="input-field" placeholder="Novità e aggiornamenti MindCalm" />
                </div>
              </div>

              <div class="mt-5">
                <label class="label">Contenuto HTML</label>
                <TiptapEditor v-model="form.htmlBody" placeholder="Scrivi la comunicazione..." />
              </div>

              <div class="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  class="btn-secondary"
                  :disabled="previewing || !canPreview"
                  @click="previewAudience"
                >
                  {{ previewing ? 'Aggiornamento audience...' : 'Aggiorna audience' }}
                </button>
                <button
                  type="button"
                  class="btn-primary"
                  :disabled="sending || !canSend"
                  @click="sendCommunication"
                >
                  {{ sending ? 'Invio in corso...' : 'Invia comunicazione' }}
                </button>
              </div>
            </section>

            <section class="card">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p class="text-lg font-semibold text-text-primary">Anteprima contenuto</p>
                  <p class="mt-1 text-sm text-text-secondary">
                    Visualizzazione rapida del messaggio che verrà registrato nella comunicazione.
                  </p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-text-secondary">
                  Oggetto:
                  <span class="font-semibold text-text-primary">{{ form.subject || 'non definito' }}</span>
                </div>
              </div>

              <div class="mt-5 rounded-3xl border border-ui-border bg-slate-50 px-5 py-5">
                <div class="rounded-2xl border border-white bg-white px-5 py-5 shadow-sm">
                  <p class="text-sm font-medium text-text-primary">{{ form.subject || 'Oggetto email' }}</p>
                  <div class="mt-4 max-w-none text-sm leading-7 text-text-primary" v-html="form.htmlBody" />
                </div>
              </div>
            </section>
          </div>

          <div class="space-y-6">
            <section class="card">
              <p class="text-lg font-semibold text-text-primary">Audience</p>
              <p class="mt-1 text-sm text-text-secondary">
                Seleziona le formule da includere. Le versioni sono opzionali e restringono la comunicazione a uno storico specifico.
              </p>

              <div class="mt-5">
                <label class="label">Logica di combinazione</label>
                <select v-model="form.matchMode" class="input-field">
                  <option v-for="mode in options.matchModes" :key="mode" :value="mode">
                    {{ getMatchModeLabel(mode) }}
                  </option>
                </select>
              </div>

              <div class="mt-5 space-y-4">
                <article
                  v-for="formula in options.formulas"
                  :key="formula.id"
                  class="rounded-2xl border p-4 transition-colors"
                  :class="isFormulaSelected(formula.id) ? 'border-primary/30 bg-primary/5' : 'border-ui-border bg-white'"
                >
                  <label class="flex items-start gap-3">
                    <input
                      :checked="isFormulaSelected(formula.id)"
                      type="checkbox"
                      class="mt-1 h-4 w-4 rounded border-ui-border"
                      @change="toggleFormula(formula.id)"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-semibold text-text-primary">{{ getFormulaTitle(formula) }}</p>
                        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-text-secondary">{{ formula.code }}</span>
                      </div>
                      <p class="mt-1 text-sm text-text-secondary">
                        {{ formula.required ? 'Richiesto in fase di iscrizione' : 'Facoltativo' }}
                      </p>
                    </div>
                  </label>

                  <div v-if="isFormulaSelected(formula.id)" class="mt-4 border-t border-ui-border pt-4">
                    <p class="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Versioni specifiche</p>
                    <div class="mt-3 space-y-2">
                      <label
                        v-for="version in formula.versions"
                        :key="version.id"
                        class="flex items-start gap-3 rounded-xl border border-ui-border px-3 py-3 text-sm"
                      >
                        <input
                          :checked="isVersionSelected(formula.id, version.id)"
                          type="checkbox"
                          class="mt-0.5 h-4 w-4 rounded border-ui-border"
                          @change="toggleVersion(formula.id, version.id)"
                        />
                        <div class="min-w-0">
                          <p class="font-medium text-text-primary">{{ getVersionTitle(version) }}</p>
                          <p class="mt-1 text-text-secondary">
                            v{{ version.versionNumber }} · {{ version.status }}<span v-if="formula.currentVersionId === version.id"> · corrente</span>
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section class="card">
              <p class="text-lg font-semibold text-text-primary">Controlli prima dell’invio</p>
              <div class="mt-4 space-y-3">
                <div
                  v-for="item in readinessItems"
                  :key="item.label"
                  class="rounded-2xl border px-4 py-4"
                  :class="item.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'"
                >
                  <div class="flex items-center justify-between gap-4">
                    <p class="text-sm font-semibold" :class="item.ok ? 'text-emerald-800' : 'text-amber-800'">{{ item.label }}</p>
                    <span class="text-xs font-semibold uppercase tracking-[0.16em]" :class="item.ok ? 'text-emerald-700' : 'text-amber-700'">
                      {{ item.ok ? 'OK' : 'Da fare' }}
                    </span>
                  </div>
                  <p class="mt-2 text-sm" :class="item.ok ? 'text-emerald-700' : 'text-amber-700'">{{ item.detail }}</p>
                </div>
              </div>
            </section>

            <section class="card">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-lg font-semibold text-text-primary">Destinatari campione</p>
                  <p class="mt-1 text-sm text-text-secondary">Primi contatti restituiti dall’anteprima corrente.</p>
                </div>
                <span class="text-sm font-semibold text-text-primary">{{ previewTotal.toLocaleString('it-IT') }}</span>
              </div>

              <div v-if="!previewContacts.length" class="mt-4 rounded-2xl border border-dashed border-ui-border px-4 py-6 text-sm text-text-secondary">
                Esegui l’anteprima per visualizzare l’audience risultante.
              </div>

              <div v-else class="mt-4 space-y-3">
                <div
                  v-for="contact in previewContacts.slice(0, 10)"
                  :key="contact.id"
                  class="rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <p class="text-sm font-medium text-text-primary">{{ contact.email }}</p>
                  <p class="mt-1 text-xs uppercase tracking-[0.16em] text-text-secondary">{{ contact.status }}</p>
                </div>
                <p v-if="previewContacts.length > 10" class="text-sm text-text-secondary">
                  Mostrati i primi 10 destinatari.
                </p>
              </div>
            </section>
          </div>
        </div>

        <section class="mt-6 card">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p class="text-lg font-semibold text-text-primary">Storico comunicazioni</p>
              <p class="mt-1 text-sm text-text-secondary">
                Vista continua degli ultimi invii con dettaglio immediato della comunicazione selezionata.
              </p>
            </div>
            <div class="grid grid-cols-3 gap-3 text-sm">
              <div class="rounded-2xl bg-slate-50 px-4 py-3">
                <p class="text-text-secondary">Totale</p>
                <p class="mt-1 font-semibold text-text-primary">{{ historySummary.total }}</p>
              </div>
              <div class="rounded-2xl bg-slate-50 px-4 py-3">
                <p class="text-text-secondary">Inviate</p>
                <p class="mt-1 font-semibold text-text-primary">{{ historySummary.sent }}</p>
              </div>
              <div class="rounded-2xl bg-slate-50 px-4 py-3">
                <p class="text-text-secondary">Annullate</p>
                <p class="mt-1 font-semibold text-text-primary">{{ historySummary.cancelled }}</p>
              </div>
            </div>
          </div>

          <div v-if="!historyItems.length" class="mt-6 rounded-2xl border border-dashed border-ui-border px-4 py-8 text-center text-sm text-text-secondary">
            Nessuna comunicazione inviata finora.
          </div>

          <div v-else class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div class="space-y-3">
              <button
                v-for="item in historyItems"
                :key="item.id"
                type="button"
                class="w-full rounded-2xl border px-4 py-4 text-left transition-colors"
                :class="selectedCampaign?.id === item.id ? 'border-primary bg-primary/5' : 'border-ui-border bg-white hover:bg-slate-50'"
                @click="selectedCampaignId = item.id"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-text-primary">{{ item.name }}</p>
                    <p class="mt-1 truncate text-sm text-text-secondary">{{ item.subject }}</p>
                  </div>
                  <span :class="['inline-flex rounded-full px-3 py-1 text-xs font-semibold', getCampaignStatusClasses(item.status)]">
                    {{ getCampaignStatusLabel(item.status) }}
                  </span>
                </div>
                <p class="mt-3 text-xs uppercase tracking-[0.16em] text-text-secondary">{{ getFormulaBadgeText(item) }}</p>
                <p class="mt-2 text-sm text-text-secondary">
                  {{ item.sentCount }} inviate · {{ item.failedCount }} errori · {{ formatDateTime(item.sentAt || item.createdAt) }}
                </p>
              </button>
            </div>

            <div v-if="selectedCampaign" class="rounded-3xl border border-ui-border bg-slate-50 px-5 py-5">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 class="text-xl font-semibold text-text-primary">{{ selectedCampaign.name }}</h2>
                    <span :class="['inline-flex rounded-full px-3 py-1 text-xs font-semibold', getCampaignStatusClasses(selectedCampaign.status)]">
                      {{ getCampaignStatusLabel(selectedCampaign.status) }}
                    </span>
                  </div>
                  <p class="mt-2 text-sm font-medium text-text-primary">{{ selectedCampaign.subject }}</p>
                  <p class="mt-2 text-sm text-text-secondary">{{ getFormulaBadgeText(selectedCampaign) }}</p>
                  <p class="mt-1 text-sm text-text-secondary">
                    Creata da {{ selectedCampaign.createdByUser?.name || selectedCampaign.createdByUser?.email || 'Sistema' }}
                    · {{ formatDateTime(selectedCampaign.createdAt) }}
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.16em] text-text-secondary">Totale</p>
                    <p class="mt-2 text-lg font-semibold text-text-primary">{{ selectedCampaign.recipientsCount }}</p>
                  </div>
                  <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.16em] text-text-secondary">Inviate</p>
                    <p class="mt-2 text-lg font-semibold text-text-primary">{{ selectedCampaign.sentCount }}</p>
                  </div>
                  <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.16em] text-text-secondary">Errori</p>
                    <p class="mt-2 text-lg font-semibold text-text-primary">{{ selectedCampaign.failedCount }}</p>
                  </div>
                  <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <p class="text-xs uppercase tracking-[0.16em] text-text-secondary">Logica</p>
                    <p class="mt-2 text-sm font-semibold text-text-primary">{{ getMatchModeLabel(selectedCampaign.matchMode) }}</p>
                  </div>
                </div>
              </div>

              <div class="mt-5 rounded-2xl border border-ui-border bg-white px-5 py-5 shadow-sm">
                <p class="text-sm font-semibold text-text-primary">Contenuto registrato</p>
                <div class="mt-4 max-w-none text-sm leading-7 text-text-primary" v-html="selectedCampaign.htmlBody" />
              </div>
            </div>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
