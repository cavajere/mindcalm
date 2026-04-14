<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import TiptapEditor from '../components/TiptapEditor.vue'
import LegalSectionTabs from '../components/LegalSectionTabs.vue'
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

type TermsPolicy = {
  id: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  currentVersionId: string | null
  versions: PolicyVersion[]
}

const publicBaseUrl = getPublicAppUrl()

const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const success = ref('')
const termsPolicy = ref<TermsPolicy | null>(null)
const selectedTermsVersionId = ref('')

const savingTermsTranslations = ref(false)
const creatingTermsDraft = ref(false)
const publishingTerms = ref(false)

const selectedTermsVersion = computed(() => (
  termsPolicy.value?.versions.find((version) => version.id === selectedTermsVersionId.value) ?? null
))

const termsPublicUrl = computed(() => `${publicBaseUrl}/public-api/terms?lang=it`)
const termsCurrentVersionNumber = computed(() => (
  termsPolicy.value?.currentVersionId
    ? termsPolicy.value.versions.find((version) => version.id === termsPolicy.value?.currentVersionId)?.versionNumber ?? null
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

function isDraftVersion(version: PolicyVersion | null) {
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
    const { data } = await axios.get<TermsPolicy>('/api/admin/terms/mine')
    termsPolicy.value = data
    termsPolicy.value.versions.forEach(normalizeDocumentTranslations)
    selectedTermsVersionId.value = getPreferredVersionId(termsPolicy.value.versions, termsPolicy.value.currentVersionId)
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento sezione termini fallito')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function createTermsDraft() {
  if (!termsPolicy.value) return

  resetFlashMessages()
  creatingTermsDraft.value = true

  try {
    await axios.post(`/api/admin/terms/${termsPolicy.value.id}/versions`)
    await fetchPolicy(true)
    success.value = 'Nuova bozza termini creata'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Creazione bozza termini fallita')
  } finally {
    creatingTermsDraft.value = false
  }
}

async function saveTermsTranslations() {
  const version = selectedTermsVersion.value
  const policy = termsPolicy.value
  if (!version || !policy) return

  resetFlashMessages()
  savingTermsTranslations.value = true

  try {
    await axios.put(`/api/admin/terms/${policy.id}/versions/${version.id}/translations`, {
      translations: version.translations,
    })
    await fetchPolicy(true)
    success.value = 'Traduzioni termini salvate'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Salvataggio termini fallito')
  } finally {
    savingTermsTranslations.value = false
  }
}

async function publishTermsVersion() {
  const version = selectedTermsVersion.value
  const policy = termsPolicy.value
  if (!version || !policy) return

  resetFlashMessages()
  publishingTerms.value = true

  try {
    await axios.post(`/api/admin/terms/${policy.id}/versions/${version.id}/publish`)
    await fetchPolicy(true)
    success.value = 'Versione termini pubblicata'
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Publish termini fallito')
  } finally {
    publishingTerms.value = false
  }
}

onMounted(() => {
  fetchPolicy()
})
</script>

<template>
  <div>
    <PageHeader
      title="Terms & Conditions"
      description="Gestisci le versioni dei termini contrattuali richiesti durante la registrazione."
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

    <div v-if="loading && !termsPolicy" class="card text-sm text-text-secondary">
      Caricamento sezione termini...
    </div>

    <section v-else-if="termsPolicy" class="card space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="text-lg font-semibold text-text-primary">Terms & Conditions</p>
          <p class="mt-1 text-sm text-text-secondary">
            Questi contenuti vengono mostrati pubblicamente e sono richiesti nel flusso di registrazione.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <a :href="termsPublicUrl" target="_blank" rel="noreferrer" class="btn-secondary">
            Apri pagina pubblica
          </a>
          <button class="btn-secondary" :disabled="creatingTermsDraft" @click="createTermsDraft">
            {{ creatingTermsDraft ? 'Creazione...' : 'Nuova bozza' }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div class="rounded-2xl bg-slate-50 px-4 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Stato policy</p>
          <p class="mt-2">
            <span :class="['inline-flex rounded-full px-3 py-1 text-xs font-semibold', getStatusBadgeClasses(termsPolicy.status)]">
              {{ termsPolicy.status }}
            </span>
          </p>
        </div>
        <div class="rounded-2xl bg-slate-50 px-4 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Versione corrente</p>
          <p class="mt-2 text-lg font-semibold text-text-primary">
            {{ termsCurrentVersionNumber ? `v${termsCurrentVersionNumber}` : 'Nessuna' }}
          </p>
        </div>
        <div class="rounded-2xl bg-slate-50 px-4 py-4">
          <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Versioni</p>
          <p class="mt-2 text-lg font-semibold text-text-primary">{{ termsPolicy.versions.length }}</p>
        </div>
      </div>

      <div>
        <label class="label">Versione da modificare</label>
        <select v-model="selectedTermsVersionId" class="input-field">
          <option v-for="version in termsPolicy.versions" :key="version.id" :value="version.id">
            {{ formatVersionLabel(version) }}
          </option>
        </select>
      </div>

      <div v-if="selectedTermsVersion" class="space-y-4">
        <div class="flex items-center justify-between rounded-2xl border border-ui-border px-4 py-3">
          <div>
            <p class="text-sm font-medium text-text-primary">Dettagli versione</p>
            <p class="mt-1 text-sm text-text-secondary">
              {{ selectedTermsVersion.publishedAt ? `Pubblicata il ${new Date(selectedTermsVersion.publishedAt).toLocaleString('it-IT')}` : 'Bozza non ancora pubblicata' }}
            </p>
          </div>
          <span :class="['inline-flex rounded-full px-3 py-1 text-xs font-semibold', getStatusBadgeClasses(selectedTermsVersion.status)]">
            {{ selectedTermsVersion.status }}
          </span>
        </div>

        <div
          v-for="(translation, index) in selectedTermsVersion.translations"
          :key="`${selectedTermsVersion.id}-${index}`"
          class="rounded-2xl border border-ui-border p-4"
        >
          <div class="mb-4 flex items-center justify-between">
            <p class="text-sm font-semibold text-text-primary">Traduzione {{ index + 1 }}</p>
            <button
              type="button"
              class="text-sm text-red-600 disabled:text-slate-400"
              :disabled="selectedTermsVersion.translations.length === 1 || !isDraftVersion(selectedTermsVersion)"
              @click="removeDocumentTranslation(selectedTermsVersion, index)"
            >
              Rimuovi
            </button>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="label">Lingua</label>
              <input v-model="translation.lang" :disabled="!isDraftVersion(selectedTermsVersion)" class="input-field" placeholder="it" />
            </div>
            <div>
              <label class="label">Titolo</label>
              <input v-model="translation.title" :disabled="!isDraftVersion(selectedTermsVersion)" class="input-field" placeholder="Termini e condizioni" />
            </div>
          </div>

          <div class="mt-4">
            <label class="label">Etichetta pulsante</label>
            <input v-model="translation.buttonLabel" :disabled="!isDraftVersion(selectedTermsVersion)" class="input-field" placeholder="Accetto i termini" />
          </div>

          <div class="mt-4">
            <label class="label">HTML documento</label>
            <TiptapEditor v-model="translation.html" :disabled="!isDraftVersion(selectedTermsVersion)" placeholder="Scrivi i termini e le condizioni..." />
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <button type="button" class="btn-secondary" :disabled="!isDraftVersion(selectedTermsVersion)" @click="addDocumentTranslation(selectedTermsVersion)">
            Aggiungi traduzione
          </button>
          <button type="button" class="btn-primary" :disabled="savingTermsTranslations || !isDraftVersion(selectedTermsVersion)" @click="saveTermsTranslations">
            {{ savingTermsTranslations ? 'Salvataggio...' : 'Salva termini' }}
          </button>
          <button type="button" class="btn-secondary" :disabled="publishingTerms || !isDraftVersion(selectedTermsVersion)" @click="publishTermsVersion">
            {{ publishingTerms ? 'Pubblicazione...' : 'Pubblica versione' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
