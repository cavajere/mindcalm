<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import TiptapEditor from '../components/TiptapEditor.vue'
import LegalSectionTabs from '../components/LegalSectionTabs.vue'
import { useConfirm } from '../composables/useConfirm'
import { getApiErrorMessage } from '../utils/apiMessages'
import { getPublicAppUrl } from '../utils/appUrls'

type DocumentTranslation = {
  lang: string
  title?: string | null
  html: string
  buttonLabel?: string | null
}

type PolicyVersion = {
  id: string
  versionNumber: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  publishedAt: string | null
  translations: DocumentTranslation[]
}

type FormulaTranslation = {
  lang: string
  title: string
  text: string
}

type FormulaVersion = {
  id: string
  versionNumber: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  subscriptionPolicyVersionId: string
  translations: FormulaTranslation[]
}

type ConsentFormula = {
  id: string
  code: string
  required: boolean
  status: 'ACTIVE' | 'ARCHIVED'
  currentVersionId: string | null
  versions: FormulaVersion[]
}

type PrivacyPolicy = {
  id: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  currentVersionId: string | null
  versions: PolicyVersion[]
  consentFormulas: ConsentFormula[]
}

const publicBaseUrl = getPublicAppUrl()
const { confirm } = useConfirm()

const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const success = ref('')
const privacyPolicy = ref<PrivacyPolicy | null>(null)
const selectedPrivacyVersionId = ref('')

const savingPrivacyTranslations = ref(false)
const creatingPrivacyDraft = ref(false)
const publishingPrivacy = ref(false)
const creatingFormula = ref(false)
const busyFormulaId = ref('')

const newFormula = reactive({
  code: '',
  required: false,
})

const selectedPrivacyVersion = computed(() => (
  privacyPolicy.value?.versions.find((version) => version.id === selectedPrivacyVersionId.value) ?? null
))

const privacyPublicUrl = computed(() => `${publicBaseUrl}/public-api/privacy?lang=it`)
const privacyCurrentVersionNumber = computed(() => (
  privacyPolicy.value?.currentVersionId
    ? privacyPolicy.value.versions.find((version) => version.id === privacyPolicy.value?.currentVersionId)?.versionNumber ?? null
    : null
))

function getPreferredVersionId(versions: PolicyVersion[], currentVersionId: string | null) {
  return versions.find((version) => version.status === 'DRAFT')?.id
    || currentVersionId
    || versions[0]?.id
    || ''
}

function resetFlashMessages() {
  error.value = ''
  success.value = ''
}

function normalizeDocumentTranslations(version: PolicyVersion) {
  if (!version.translations.length) {
    version.translations.push({
      lang: 'it',
      title: '',
      html: '',
      buttonLabel: '',
    })
  }
}

function normalizeFormulaTranslations(version: FormulaVersion) {
  if (!version.translations.length) {
    version.translations.push({
      lang: 'it',
      title: '',
      text: '',
    })
  }
}

function addDocumentTranslation(version: PolicyVersion) {
  version.translations.push({
    lang: '',
    title: '',
    html: '',
    buttonLabel: '',
  })
}

function removeDocumentTranslation(version: PolicyVersion, index: number) {
  version.translations.splice(index, 1)
  normalizeDocumentTranslations(version)
}

function addFormulaTranslation(version: FormulaVersion) {
  version.translations.push({
    lang: '',
    title: '',
    text: '',
  })
}

function removeFormulaTranslation(version: FormulaVersion, index: number) {
  version.translations.splice(index, 1)
  normalizeFormulaTranslations(version)
}

function getFormulaVersionForSelectedPolicy(formula: ConsentFormula) {
  return formula.versions.find((version) => version.subscriptionPolicyVersionId === selectedPrivacyVersionId.value) ?? null
}

function getSelectedFormulaTranslations(formula: ConsentFormula) {
  return getFormulaVersionForSelectedPolicy(formula)?.translations ?? []
}

function canEditSelectedFormulaVersion(formula: ConsentFormula) {
  return getFormulaVersionForSelectedPolicy(formula)?.status === 'DRAFT'
}

function isDraftVersion(version: PolicyVersion | FormulaVersion | null) {
  return version?.status === 'DRAFT'
}

function getStatusBadgeClasses(status: string) {
  if (status === 'PUBLISHED') return 'bg-emerald-100 text-emerald-800'
  if (status === 'DRAFT') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-200 text-slate-700'
}

function formatVersionLabel(version: PolicyVersion) {
  return `v${version.versionNumber} · ${version.status}`
}

async function fetchPolicy(background = false) {
  resetFlashMessages()

  if (background) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  try {
    const { data } = await axios.get<PrivacyPolicy>('/api/subscriptions/mine')
    privacyPolicy.value = data

    privacyPolicy.value.versions.forEach(normalizeDocumentTranslations)
    privacyPolicy.value.consentFormulas.forEach((formula) => {
      formula.versions.forEach(normalizeFormulaTranslations)
    })

    selectedPrivacyVersionId.value = getPreferredVersionId(privacyPolicy.value.versions, privacyPolicy.value.currentVersionId)
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento sezione privacy fallito')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function createPrivacyDraft() {
  if (!privacyPolicy.value) return

  resetFlashMessages()
  creatingPrivacyDraft.value = true

  try {
    await axios.post(`/api/subscriptions/${privacyPolicy.value.id}/versions`)
    await fetchPolicy(true)
    success.value = 'Nuova bozza privacy creata'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Creazione bozza privacy fallita')
  } finally {
    creatingPrivacyDraft.value = false
  }
}

async function savePrivacyTranslations() {
  const version = selectedPrivacyVersion.value
  const policy = privacyPolicy.value
  if (!version || !policy) return

  resetFlashMessages()
  savingPrivacyTranslations.value = true

  try {
    await axios.put(`/api/subscriptions/${policy.id}/versions/${version.id}/translations`, {
      translations: version.translations,
    })
    await fetchPolicy(true)
    success.value = 'Traduzioni privacy salvate'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Salvataggio privacy fallito')
  } finally {
    savingPrivacyTranslations.value = false
  }
}

async function publishPrivacyVersion() {
  const version = selectedPrivacyVersion.value
  const policy = privacyPolicy.value
  if (!version || !policy) return

  resetFlashMessages()
  publishingPrivacy.value = true

  try {
    await axios.post(`/api/subscriptions/${policy.id}/versions/${version.id}/publish`)
    await fetchPolicy(true)
    success.value = 'Versione privacy pubblicata'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Publish privacy fallito')
  } finally {
    publishingPrivacy.value = false
  }
}

async function createConsentFormula() {
  if (!privacyPolicy.value || !newFormula.code.trim()) return

  resetFlashMessages()
  creatingFormula.value = true

  try {
    await axios.post(`/api/subscriptions/${privacyPolicy.value.id}/formulas`, {
      code: newFormula.code.trim(),
      required: newFormula.required,
    })
    newFormula.code = ''
    newFormula.required = false
    await fetchPolicy(true)
    success.value = 'Formula di consenso creata'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Creazione formula fallita')
  } finally {
    creatingFormula.value = false
  }
}

async function saveConsentFormula(formula: ConsentFormula) {
  if (!privacyPolicy.value) return

  resetFlashMessages()
  busyFormulaId.value = formula.id

  try {
    await axios.put(`/api/subscriptions/${privacyPolicy.value.id}/formulas/${formula.id}`, {
      required: formula.required,
    })
    await fetchPolicy(true)
    success.value = `Formula ${formula.code} aggiornata`
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Aggiornamento formula fallito')
  } finally {
    busyFormulaId.value = ''
  }
}

async function archiveConsentFormula(formula: ConsentFormula) {
  if (!privacyPolicy.value) return
  if (!await confirm({ message: `Archiviare la formula ${formula.code}?`, variant: 'warning' })) return

  resetFlashMessages()
  busyFormulaId.value = formula.id

  try {
    await axios.delete(`/api/subscriptions/${privacyPolicy.value.id}/formulas/${formula.id}`)
    await fetchPolicy(true)
    success.value = `Formula ${formula.code} archiviata`
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Archiviazione formula fallita')
  } finally {
    busyFormulaId.value = ''
  }
}

async function saveFormulaTranslations(formula: ConsentFormula) {
  const formulaVersion = getFormulaVersionForSelectedPolicy(formula)
  if (!formulaVersion) {
    error.value = 'Nessuna versione formula disponibile per la versione privacy selezionata'
    return
  }

  resetFlashMessages()
  busyFormulaId.value = formula.id

  try {
    await axios.put(`/api/subscriptions/formulas/${formulaVersion.id}/translations`, {
      translations: formulaVersion.translations,
    })
    await fetchPolicy(true)
    success.value = `Traduzioni formula ${formula.code} salvate`
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Salvataggio traduzioni formula fallito')
  } finally {
    busyFormulaId.value = ''
  }
}

function addSelectedFormulaTranslation(formula: ConsentFormula) {
  const version = getFormulaVersionForSelectedPolicy(formula)
  if (!version) return
  addFormulaTranslation(version)
}

function removeSelectedFormulaTranslation(formula: ConsentFormula, index: number) {
  const version = getFormulaVersionForSelectedPolicy(formula)
  if (!version) return
  removeFormulaTranslation(version, index)
}

onMounted(() => {
  fetchPolicy()
})
</script>

<template>
  <div>
    <PageHeader
      title="Legal"
      description="Gestisci l’informativa privacy pubblica e le formule usate nei consensi comunicazione."
    >
      <template #actions>
        <button class="btn-secondary" :disabled="refreshing || loading" @click="fetchPolicy(true)">
          {{ refreshing ? 'Aggiornamento...' : 'Aggiorna' }}
        </button>
      </template>
    </PageHeader>

    <LegalSectionTabs />

    <div v-if="error" class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ error }}
    </div>
    <div v-if="success" class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {{ success }}
    </div>

    <div v-if="loading && !privacyPolicy" class="card text-sm text-text-secondary">
      Caricamento sezione privacy...
    </div>

    <template v-else-if="privacyPolicy">
      <section class="card space-y-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="text-lg font-semibold text-text-primary">Informativa privacy</p>
              <p class="mt-1 text-sm text-text-secondary">
              Versiona il testo privacy pubblico e le etichette usate per i consensi comunicazione.
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <a :href="privacyPublicUrl" target="_blank" rel="noreferrer" class="btn-secondary">
              Apri pagina pubblica
            </a>
            <button class="btn-secondary" :disabled="creatingPrivacyDraft" @click="createPrivacyDraft">
              {{ creatingPrivacyDraft ? 'Creazione...' : 'Nuova bozza' }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div class="rounded-2xl bg-slate-50 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Stato policy</p>
            <p class="mt-2">
              <span :class="['inline-flex rounded-full px-3 py-1 text-xs font-semibold', getStatusBadgeClasses(privacyPolicy.status)]">
                {{ privacyPolicy.status }}
              </span>
            </p>
          </div>
          <div class="rounded-2xl bg-slate-50 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Versione corrente</p>
            <p class="mt-2 text-lg font-semibold text-text-primary">
              {{ privacyCurrentVersionNumber ? `v${privacyCurrentVersionNumber}` : 'Nessuna' }}
            </p>
          </div>
          <div class="rounded-2xl bg-slate-50 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Versioni</p>
            <p class="mt-2 text-lg font-semibold text-text-primary">{{ privacyPolicy.versions.length }}</p>
          </div>
        </div>

        <div>
          <label class="label">Versione da modificare</label>
          <select v-model="selectedPrivacyVersionId" class="input-field">
            <option v-for="version in privacyPolicy.versions" :key="version.id" :value="version.id">
              {{ formatVersionLabel(version) }}
            </option>
          </select>
        </div>

        <div v-if="selectedPrivacyVersion" class="space-y-4">
          <div class="flex items-center justify-between rounded-2xl border border-ui-border px-4 py-3">
            <div>
              <p class="text-sm font-medium text-text-primary">Dettagli versione</p>
              <p class="mt-1 text-sm text-text-secondary">
                {{ selectedPrivacyVersion.publishedAt ? `Pubblicata il ${new Date(selectedPrivacyVersion.publishedAt).toLocaleString('it-IT')}` : 'Bozza non ancora pubblicata' }}
              </p>
            </div>
            <span :class="['inline-flex rounded-full px-3 py-1 text-xs font-semibold', getStatusBadgeClasses(selectedPrivacyVersion.status)]">
              {{ selectedPrivacyVersion.status }}
            </span>
          </div>

          <div
            v-for="(translation, index) in selectedPrivacyVersion.translations"
            :key="`${selectedPrivacyVersion.id}-${index}`"
            class="rounded-2xl border border-ui-border p-4"
          >
            <div class="mb-4 flex items-center justify-between">
              <p class="text-sm font-semibold text-text-primary">Traduzione {{ index + 1 }}</p>
              <button
                type="button"
                class="text-sm text-red-600 disabled:text-slate-400"
                :disabled="selectedPrivacyVersion.translations.length === 1 || !isDraftVersion(selectedPrivacyVersion)"
                @click="removeDocumentTranslation(selectedPrivacyVersion, index)"
              >
                Rimuovi
              </button>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label class="label">Lingua</label>
                <input v-model="translation.lang" :disabled="!isDraftVersion(selectedPrivacyVersion)" class="input-field" placeholder="it" />
              </div>
              <div>
                <label class="label">Titolo</label>
                <input v-model="translation.title" :disabled="!isDraftVersion(selectedPrivacyVersion)" class="input-field" placeholder="Informativa privacy" />
              </div>
            </div>

            <div class="mt-4">
              <label class="label">Etichetta pulsante</label>
              <input v-model="translation.buttonLabel" :disabled="!isDraftVersion(selectedPrivacyVersion)" class="input-field" placeholder="Iscriviti" />
            </div>

            <div class="mt-4">
              <label class="label">HTML documento</label>
              <TiptapEditor v-model="translation.html" :disabled="!isDraftVersion(selectedPrivacyVersion)" placeholder="Scrivi l'informativa privacy..." />
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <button type="button" class="btn-secondary" :disabled="!isDraftVersion(selectedPrivacyVersion)" @click="addDocumentTranslation(selectedPrivacyVersion)">
              Aggiungi traduzione
            </button>
            <button type="button" class="btn-primary" :disabled="savingPrivacyTranslations || !isDraftVersion(selectedPrivacyVersion)" @click="savePrivacyTranslations">
              {{ savingPrivacyTranslations ? 'Salvataggio...' : 'Salva privacy' }}
            </button>
            <button type="button" class="btn-secondary" :disabled="publishingPrivacy || !isDraftVersion(selectedPrivacyVersion)" @click="publishPrivacyVersion">
              {{ publishingPrivacy ? 'Pubblicazione...' : 'Pubblica versione' }}
            </button>
          </div>
        </div>
      </section>

      <section class="card mt-6 space-y-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="text-lg font-semibold text-text-primary">Consensi comunicazione</p>
            <p class="mt-1 text-sm text-text-secondary">
              Le traduzioni delle formule seguono la versione privacy selezionata. Le modifiche sono consentite solo su una bozza.
            </p>
          </div>

          <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-text-secondary">
            Versione privacy attiva per l’editor:
            <span class="font-semibold text-text-primary">
              {{ selectedPrivacyVersion ? `v${selectedPrivacyVersion.versionNumber}` : 'Nessuna' }}
            </span>
          </div>
        </div>

        <form class="grid grid-cols-1 gap-4 rounded-2xl border border-dashed border-ui-border p-4 md:grid-cols-[minmax(0,1fr)_180px_auto]" @submit.prevent="createConsentFormula">
          <div>
            <label class="label">Codice formula</label>
            <input v-model="newFormula.code" class="input-field" placeholder="newsletter_comunicazioni" />
          </div>
          <label class="flex items-center gap-3 rounded-xl border border-ui-border px-4 py-3 text-sm text-text-primary">
            <input v-model="newFormula.required" type="checkbox" class="h-4 w-4 rounded border-ui-border" />
            Consenso obbligatorio
          </label>
          <button type="submit" class="btn-primary" :disabled="creatingFormula || !newFormula.code.trim()">
            {{ creatingFormula ? 'Creazione...' : 'Aggiungi formula' }}
          </button>
        </form>

        <div v-if="!privacyPolicy.consentFormulas.length" class="rounded-2xl border border-dashed border-ui-border px-4 py-8 text-center text-sm text-text-secondary">
          Nessuna formula di consenso configurata.
        </div>

        <div v-else class="space-y-4">
          <article
            v-for="formula in privacyPolicy.consentFormulas"
            :key="formula.id"
            class="rounded-2xl border border-ui-border p-5"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-base font-semibold text-text-primary">{{ formula.code }}</p>
                  <span :class="['inline-flex rounded-full px-3 py-1 text-xs font-semibold', formula.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700']">
                    {{ formula.status }}
                  </span>
                </div>
                <p class="mt-1 text-sm text-text-secondary">
                  Versione formula collegata: {{ getFormulaVersionForSelectedPolicy(formula)?.versionNumber ? `v${getFormulaVersionForSelectedPolicy(formula)?.versionNumber}` : 'non disponibile' }}
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <label class="flex items-center gap-3 rounded-xl border border-ui-border px-4 py-2 text-sm text-text-primary">
                  <input v-model="formula.required" type="checkbox" class="h-4 w-4 rounded border-ui-border" />
                  Richiesto
                </label>
                <button type="button" class="btn-secondary" :disabled="busyFormulaId === formula.id" @click="saveConsentFormula(formula)">
                  Salva formula
                </button>
                <button type="button" class="btn-secondary" :disabled="busyFormulaId === formula.id" @click="archiveConsentFormula(formula)">
                  Archivia
                </button>
              </div>
            </div>

            <div v-if="getFormulaVersionForSelectedPolicy(formula)" class="mt-5 space-y-4">
              <div
                v-for="(translation, index) in getSelectedFormulaTranslations(formula)"
                :key="`${formula.id}-${selectedPrivacyVersionId}-${index}`"
                class="rounded-2xl bg-slate-50 p-4"
              >
                <div class="mb-4 flex items-center justify-between">
                  <p class="text-sm font-semibold text-text-primary">Traduzione {{ index + 1 }}</p>
                  <button
                    type="button"
                    class="text-sm text-red-600 disabled:text-slate-400"
                    :disabled="getSelectedFormulaTranslations(formula).length === 1 || !canEditSelectedFormulaVersion(formula)"
                    @click="removeSelectedFormulaTranslation(formula, index)"
                  >
                    Rimuovi
                  </button>
                </div>

                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label class="label">Lingua</label>
                    <input v-model="translation.lang" :disabled="!canEditSelectedFormulaVersion(formula)" class="input-field" placeholder="it" />
                  </div>
                  <div>
                    <label class="label">Titolo</label>
                    <input v-model="translation.title" :disabled="!canEditSelectedFormulaVersion(formula)" class="input-field" placeholder="Acconsento a ricevere comunicazioni" />
                  </div>
                </div>

                <div class="mt-4">
                  <label class="label">Testo</label>
                  <textarea v-model="translation.text" :disabled="!canEditSelectedFormulaVersion(formula)" rows="4" class="input-field" placeholder="Descrizione del consenso..." />
                </div>
              </div>

              <div class="flex flex-wrap gap-3">
                <button type="button" class="btn-secondary" :disabled="!canEditSelectedFormulaVersion(formula)" @click="addSelectedFormulaTranslation(formula)">
                  Aggiungi traduzione
                </button>
                <button type="button" class="btn-primary" :disabled="busyFormulaId === formula.id || !canEditSelectedFormulaVersion(formula)" @click="saveFormulaTranslations(formula)">
                  {{ busyFormulaId === formula.id ? 'Salvataggio...' : 'Salva traduzioni formula' }}
                </button>
              </div>
            </div>

            <div v-else class="mt-5 rounded-2xl border border-dashed border-ui-border px-4 py-5 text-sm text-text-secondary">
              Nessuna versione formula disponibile per la versione privacy selezionata.
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>
