<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import CommunicationSectionTabs from '../components/CommunicationSectionTabs.vue'
import PageHeader from '../components/PageHeader.vue'
import { getApiErrorMessage } from '../utils/apiMessages'

type ConsentValue = 'YES' | 'NO'
type ContactStatus = 'ACTIVE' | 'SUPPRESSED'

type ContactDetail = {
  contact: {
    id: string
    email: string
    status: ContactStatus
    suppressedAt: string | null
    suppressionReason: string | null
    createdAt: string
  }
  currentConsents: Array<{
    formulaId: string
    formulaCode: string
    formulaTitle: string
    required: boolean
    value: ConsentValue | null
    consentDate: string | null
    versionNumber: number | null
  }>
  pastConsents: Array<{
    formulaId: string
    formulaTitle: string
    value: ConsentValue
    consentDate: string
    versionNumber: number
  }>
  history: Array<{
    id: string
    value: ConsentValue
    status: 'REGISTERED' | 'CONFIRMED'
    source: string
    createdAt: string
    invalidatedAt: string | null
    invalidationReason: string | null
    consentFormulaVersion: {
      versionNumber: number
      translations: Array<{
        lang: string
        title: string
      }>
    }
  }>
}

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const togglingFormulaId = ref('')
const error = ref('')
const success = ref('')
const detail = ref<ContactDetail | null>(null)

const contactId = computed(() => String(route.params.id ?? ''))

function formatDateTime(value: string | null) {
  if (!value) return 'n/d'
  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function getStatusBadge(status: ContactStatus) {
  return status === 'SUPPRESSED'
    ? 'bg-red-100 text-red-700'
    : 'bg-emerald-100 text-emerald-700'
}

async function fetchDetail() {
  if (!contactId.value) return

  loading.value = true
  error.value = ''

  try {
    const { data } = await axios.get(`/api/admin/communications/contacts/${contactId.value}`)
    detail.value = data
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento dettaglio contatto fallito')
  } finally {
    loading.value = false
  }
}

async function updateConsent(formulaId: string, value: ConsentValue) {
  if (!contactId.value) return

  togglingFormulaId.value = formulaId
  error.value = ''
  success.value = ''

  try {
    await axios.put(`/api/admin/communications/contacts/${contactId.value}/consents`, {
      formulaId,
      value,
    })
    success.value = 'Consenso aggiornato'
    await fetchDetail()
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Aggiornamento consenso fallito')
  } finally {
    togglingFormulaId.value = ''
  }
}

async function deleteContact() {
  if (!detail.value?.contact) return
  if (!window.confirm(`Eliminare il contatto ${detail.value.contact.email}?`)) return

  try {
    await axios.delete(`/api/admin/communications/contacts/${detail.value.contact.id}`)
    router.push('/communications/contacts')
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Eliminazione contatto fallita')
  }
}

onMounted(fetchDetail)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="detail?.contact.email || 'Dettaglio contatto'"
      description="Stato del contatto, consensi correnti e storico completo delle modifiche."
    >
      <template #actions>
        <router-link to="/communications/contacts" class="btn-secondary">Torna ai contatti</router-link>
        <button v-if="detail?.contact" type="button" class="btn-secondary text-red-600" @click="deleteContact">
          Elimina
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

    <div v-if="loading" class="card text-sm text-text-secondary">Caricamento dettaglio...</div>

    <template v-else-if="detail">
      <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr),340px]">
        <div class="card">
          <div class="flex flex-wrap items-center gap-3">
            <span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', getStatusBadge(detail.contact.status)]">
              {{ detail.contact.status === 'SUPPRESSED' ? 'Soppresso' : 'Attivo' }}
            </span>
            <span class="text-sm text-text-secondary">Creato il {{ formatDateTime(detail.contact.createdAt) }}</span>
          </div>

          <dl class="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <dt class="text-xs font-medium uppercase tracking-wide text-text-secondary">Email</dt>
              <dd class="mt-1 text-sm font-semibold text-text-primary">{{ detail.contact.email }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium uppercase tracking-wide text-text-secondary">Soppresso il</dt>
              <dd class="mt-1 text-sm text-text-primary">{{ formatDateTime(detail.contact.suppressedAt) }}</dd>
            </div>
            <div class="md:col-span-2">
              <dt class="text-xs font-medium uppercase tracking-wide text-text-secondary">Motivo soppressione</dt>
              <dd class="mt-1 text-sm text-text-primary">{{ detail.contact.suppressionReason || 'Nessuno' }}</dd>
            </div>
          </dl>
        </div>

        <div class="card">
          <h2 class="text-lg font-semibold text-text-primary">Consensi storici</h2>
          <p class="mt-1 text-sm text-text-secondary">Versioni passate ancora rilevanti per questo contatto.</p>

          <div v-if="detail.pastConsents.length" class="mt-5 space-y-3">
            <div
              v-for="consent in detail.pastConsents"
              :key="`${consent.formulaId}-${consent.versionNumber}`"
              class="rounded-2xl border border-ui-border px-4 py-4"
            >
              <p class="text-sm font-semibold text-text-primary">{{ consent.formulaTitle }}</p>
              <p class="mt-1 text-sm text-text-secondary">v{{ consent.versionNumber }} · {{ formatDateTime(consent.consentDate) }}</p>
              <span :class="[
                'mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                consent.value === 'YES' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
              ]">
                {{ consent.value === 'YES' ? 'Sì' : 'No' }}
              </span>
            </div>
          </div>
          <div v-else class="mt-5 rounded-2xl border border-dashed border-ui-border px-4 py-8 text-center text-sm text-text-secondary">
            Nessun consenso su versioni passate.
          </div>
        </div>
      </section>

      <section class="card">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-text-primary">Consensi correnti</h2>
            <p class="mt-1 text-sm text-text-secondary">Puoi aggiornare le preferenze attive formula per formula.</p>
          </div>
        </div>

        <div class="mt-5 space-y-3">
          <div
            v-for="consent in detail.currentConsents"
            :key="consent.formulaId"
            class="rounded-2xl border border-ui-border px-4 py-4"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-semibold text-text-primary">{{ consent.formulaTitle }}</p>
                  <span v-if="consent.required" class="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                    Obbligatorio
                  </span>
                </div>
                <p class="mt-1 text-xs text-text-secondary">
                  {{ consent.formulaCode }} ·
                  <span v-if="consent.consentDate">v{{ consent.versionNumber }} · {{ formatDateTime(consent.consentDate) }}</span>
                  <span v-else>Nessuna scelta registrata</span>
                </p>
              </div>

              <div class="flex gap-2">
                <button
                  type="button"
                  :disabled="togglingFormulaId === consent.formulaId"
                  :class="[
                    'rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                    consent.value === 'YES' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700',
                  ]"
                  @click="updateConsent(consent.formulaId, 'YES')"
                >
                  Sì
                </button>
                <button
                  type="button"
                  :disabled="consent.required || togglingFormulaId === consent.formulaId"
                  :class="[
                    'rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    consent.value === 'NO' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700',
                  ]"
                  @click="updateConsent(consent.formulaId, 'NO')"
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <h2 class="text-lg font-semibold text-text-primary">Storico modifiche</h2>
        <p class="mt-1 text-sm text-text-secondary">Timeline completa dei record di consenso del contatto.</p>

        <div v-if="detail.history.length" class="mt-5 space-y-3">
          <article
            v-for="row in detail.history"
            :key="row.id"
            class="rounded-2xl border px-4 py-4"
            :class="row.invalidatedAt ? 'border-slate-200 bg-slate-50' : 'border-ui-border bg-white'"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p class="text-sm font-semibold text-text-primary">
                  {{
                    row.consentFormulaVersion.translations.find((translation) => translation.lang === 'it')?.title
                    || row.consentFormulaVersion.translations[0]?.title
                    || 'Formula'
                  }}
                </p>
                <p class="mt-1 text-xs text-text-secondary">
                  v{{ row.consentFormulaVersion.versionNumber }} · {{ formatDateTime(row.createdAt) }} · {{ row.source }}
                </p>
              </div>
              <div class="flex gap-2">
                <span :class="[
                  'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                  row.value === 'YES' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
                ]">
                  {{ row.value === 'YES' ? 'Sì' : 'No' }}
                </span>
                <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {{ row.status }}
                </span>
              </div>
            </div>

            <p v-if="row.invalidatedAt" class="mt-3 text-xs text-text-secondary">
              Invalidato il {{ formatDateTime(row.invalidatedAt) }}{{ row.invalidationReason ? ` · ${row.invalidationReason}` : '' }}
            </p>
          </article>
        </div>
        <div v-else class="mt-5 rounded-2xl border border-dashed border-ui-border px-4 py-8 text-center text-sm text-text-secondary">
          Nessun record storico disponibile.
        </div>
      </section>
    </template>
  </div>
</template>
