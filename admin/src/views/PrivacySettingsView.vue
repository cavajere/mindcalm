<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import TiptapEditor from '../components/TiptapEditor.vue'
import LegalSectionTabs from '../components/LegalSectionTabs.vue'
import { useConfirm } from '../composables/useConfirm'
import { getApiErrorMessage } from '../utils/apiMessages'
import { getPublicAppUrl } from '../utils/appUrls'

type PolicyVersion = {
  id: string
  versionNumber: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  publishedAt: string | null
  title: string
  html: string
  buttonLabel: string
}

type FormulaVersion = {
  id: string
  versionNumber: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  subscriptionPolicyVersionId: string
  title: string
  text: string
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

const savingPrivacyContent = ref(false)
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

const privacyPublicUrl = computed(() => `${publicBaseUrl}/public-api/privacy`)
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

function normalizePolicyVersion(version: PolicyVersion) {
  version.title = version.title ?? ''
  version.html = version.html ?? ''
  version.buttonLabel = version.buttonLabel ?? ''
}

function normalizeFormulaVersion(version: FormulaVersion) {
  version.title = version.title ?? ''
  version.text = version.text ?? ''
}

function getFormulaVersionForSelectedPolicy(formula: ConsentFormula) {
  return formula.versions.find((version) => version.subscriptionPolicyVersionId === selectedPrivacyVersionId.value) ?? null
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
    data.versions.forEach(normalizePolicyVersion)
    data.consentFormulas.forEach((formula) => {
      formula.versions.forEach(normalizeFormulaVersion)
    })
    privacyPolicy.value = data
    selectedPrivacyVersionId.value = getPreferredVersionId(data.versions, data.currentVersionId)
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

async function savePrivacyContent() {
  const version = selectedPrivacyVersion.value
  const policy = privacyPolicy.value
  if (!version || !policy) return

  resetFlashMessages()
  savingPrivacyContent.value = true

  try {
    await axios.put(`/api/subscriptions/${policy.id}/versions/${version.id}/content`, {
      title: version.title,
      html: version.html,
      buttonLabel: version.buttonLabel,
    })
    await fetchPolicy(true)
    success.value = 'Contenuti privacy salvati'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Salvataggio privacy fallito')
  } finally {
    savingPrivacyContent.value = false
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
    success.value = 'Nuova formula creata'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Creazione formula fallita')
  } finally {
    creatingFormula.value = false
  }
}

async function updateFormula(formula: ConsentFormula) {
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

async function deleteFormula(formula: ConsentFormula) {
  if (!privacyPolicy.value) return

  const accepted = await confirm({
    message: `Vuoi archiviare la formula ${formula.code}?`,
    confirmLabel: 'Archivia',
  })
  if (!accepted) return

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

async function saveFormulaContent(formula: ConsentFormula) {
  const formulaVersion = getFormulaVersionForSelectedPolicy(formula)
  if (!formulaVersion) {
    error.value = 'Nessuna versione formula disponibile per la versione privacy selezionata'
    return
  }

  resetFlashMessages()
  busyFormulaId.value = formula.id

  try {
    await axios.put(`/api/subscriptions/formulas/${formulaVersion.id}/content`, {
      title: formulaVersion.title,
      text: formulaVersion.text,
    })
    await fetchPolicy(true)
    success.value = `Contenuti formula ${formula.code} salvati`
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Salvataggio formula fallito')
  } finally {
    busyFormulaId.value = ''
  }
}

onMounted(fetchPolicy)
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
              Informativa e consensi hanno una sola lingua: quella usata dall’app pubblica.
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

          <div class="rounded-2xl border border-ui-border p-4 space-y-4">
            <div>
              <label class="label">Titolo</label>
              <input v-model="selectedPrivacyVersion.title" :disabled="!isDraftVersion(selectedPrivacyVersion)" class="input-field" placeholder="Informativa privacy" />
            </div>

            <div>
              <label class="label">Etichetta pulsante</label>
              <input v-model="selectedPrivacyVersion.buttonLabel" :disabled="!isDraftVersion(selectedPrivacyVersion)" class="input-field" placeholder="Iscriviti" />
            </div>

            <div>
              <label class="label">HTML informativa</label>
              <TiptapEditor v-model="selectedPrivacyVersion.html" :disabled="!isDraftVersion(selectedPrivacyVersion)" placeholder="Scrivi l'informativa privacy..." />
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <button type="button" class="btn-primary" :disabled="savingPrivacyContent || !isDraftVersion(selectedPrivacyVersion)" @click="savePrivacyContent">
              {{ savingPrivacyContent ? 'Salvataggio...' : 'Salva privacy' }}
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
              Le etichette delle formule seguono la versione privacy selezionata.
            </p>
          </div>
        </div>

        <div class="rounded-2xl border border-ui-border p-4">
          <p class="text-sm font-semibold text-text-primary">Nuova formula</p>
          <div class="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <div>
              <label class="label">Code</label>
              <input v-model="newFormula.code" class="input-field" placeholder="marketing" />
            </div>
            <label class="flex items-center gap-3 text-sm text-text-primary">
              <input v-model="newFormula.required" type="checkbox" class="h-4 w-4 rounded border-gray-300" />
              <span>Obbligatorio</span>
            </label>
            <button type="button" class="btn-primary" :disabled="creatingFormula" @click="createConsentFormula">
              {{ creatingFormula ? 'Creazione...' : 'Aggiungi formula' }}
            </button>
          </div>
        </div>

        <div v-if="!privacyPolicy.consentFormulas.length" class="rounded-2xl border border-dashed border-ui-border px-4 py-8 text-center text-sm text-text-secondary">
          Nessuna formula configurata.
        </div>

        <div v-for="formula in privacyPolicy.consentFormulas" :key="formula.id" class="rounded-2xl border border-ui-border p-4 space-y-4">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p class="text-sm font-semibold text-text-primary">{{ formula.code }}</p>
              <p class="mt-1 text-sm text-text-secondary">
                Versione selezionata:
                {{ getFormulaVersionForSelectedPolicy(formula) ? `v${getFormulaVersionForSelectedPolicy(formula)?.versionNumber}` : 'nessuna' }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <label class="flex items-center gap-3 text-sm text-text-primary">
                <input v-model="formula.required" type="checkbox" class="h-4 w-4 rounded border-gray-300" />
                <span>Obbligatorio</span>
              </label>
              <button type="button" class="btn-secondary" :disabled="busyFormulaId === formula.id" @click="updateFormula(formula)">
                Salva opzioni
              </button>
              <button type="button" class="btn-secondary text-red-700" :disabled="busyFormulaId === formula.id" @click="deleteFormula(formula)">
                Archivia
              </button>
            </div>
          </div>

          <template v-if="getFormulaVersionForSelectedPolicy(formula)">
            <div class="grid gap-4">
              <div>
                <label class="label">Titolo</label>
                <input
                  v-model="getFormulaVersionForSelectedPolicy(formula)!.title"
                  :disabled="!canEditSelectedFormulaVersion(formula)"
                  class="input-field"
                  placeholder="Comunicazioni promozionali"
                />
              </div>

              <div>
                <label class="label">Testo</label>
                <textarea
                  v-model="getFormulaVersionForSelectedPolicy(formula)!.text"
                  :disabled="!canEditSelectedFormulaVersion(formula)"
                  rows="4"
                  class="input-field min-h-[120px]"
                  placeholder="Descrizione mostrata nel form pubblico."
                />
              </div>
            </div>

            <div class="flex flex-wrap gap-3">
              <button type="button" class="btn-primary" :disabled="busyFormulaId === formula.id || !canEditSelectedFormulaVersion(formula)" @click="saveFormulaContent(formula)">
                {{ busyFormulaId === formula.id ? 'Salvataggio...' : 'Salva formula' }}
              </button>
            </div>
          </template>

          <div v-else class="rounded-2xl border border-dashed border-ui-border px-4 py-6 text-sm text-text-secondary">
            Nessuna versione formula disponibile per la versione privacy selezionata.
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
