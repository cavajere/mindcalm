<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import CommunicationSectionTabs from '../components/CommunicationSectionTabs.vue'
import PageHeader from '../components/PageHeader.vue'
import { getApiErrorMessage } from '../utils/apiMessages'

type CampaignSummary = {
  id: string
  name: string
  subject: string
  status: 'DRAFT' | 'SENT' | 'CANCELLED'
  sentAt: string | null
  createdAt: string
  recipientsCount: number
  sentCount: number
  failedCount: number
}

const loading = ref(true)
const error = ref('')
const summary = ref({
  contacts: 0,
  consents: 0,
  accepted: 0,
  pendingConfirmations: 0,
  suppressions: 0,
  campaigns: 0,
})
const recentCampaigns = ref<CampaignSummary[]>([])

const primaryCards = computed(() => ([
  {
    title: 'Campagne',
    value: summary.value.campaigns,
    description: 'Composer, audience preview, invii e storico.',
    to: '/communications/campaigns',
  },
  {
    title: 'Contatti',
    value: summary.value.contacts,
    description: 'Anagrafica comunicazioni con consenso attivo o storico.',
    to: '/communications/contacts',
  },
  {
    title: 'Consensi',
    value: summary.value.consents,
    description: 'Stato dei consensi, registrazioni manuali e breakdown per formula.',
    to: '/communications/consents',
  },
  {
    title: 'Suppressions',
    value: summary.value.suppressions,
    description: 'Esclusioni manuali e contatti non contattabili.',
    to: '/communications/suppressions',
  },
]))

function formatDateTime(value: string | null) {
  if (!value) return 'n/d'

  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function getCampaignStatusBadge(status: CampaignSummary['status']) {
  if (status === 'SENT') return 'bg-emerald-100 text-emerald-700'
  if (status === 'CANCELLED') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

async function fetchSummary() {
  loading.value = true
  error.value = ''

  try {
    const [contactsRes, consentsStatsRes, suppressionsRes, campaignsRes] = await Promise.all([
      axios.get('/api/admin/communications/contacts?limit=1'),
      axios.get('/api/admin/communications/consents/stats'),
      axios.get('/api/admin/communications/suppressions?limit=1'),
      axios.get('/api/campaigns?limit=100'),
    ])

    summary.value = {
      contacts: contactsRes.data.pagination?.total ?? 0,
      consents: consentsStatsRes.data.total ?? 0,
      accepted: consentsStatsRes.data.accepted ?? 0,
      pendingConfirmations: consentsStatsRes.data.pendingConfirmations ?? 0,
      suppressions: suppressionsRes.data.total ?? 0,
      campaigns: Array.isArray(campaignsRes.data.data) ? campaignsRes.data.data.length : 0,
    }
    recentCampaigns.value = Array.isArray(campaignsRes.data.data) ? campaignsRes.data.data.slice(0, 4) : []
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento overview comunicazione fallito')
  } finally {
    loading.value = false
  }
}

onMounted(fetchSummary)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Comunicazione"
      description="Area operativa per campagne email, contatti, consensi e liste di esclusione."
    >
      <template #actions>
        <router-link to="/communications/campaigns" class="btn-primary">Nuova campagna</router-link>
      </template>
    </PageHeader>

    <CommunicationSectionTabs />

    <div v-if="error" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
      {{ error }}
    </div>

    <div class="grid gap-4 lg:grid-cols-4">
      <article v-for="card in primaryCards" :key="card.title" class="card p-5">
        <div class="flex h-full flex-col justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-text-secondary">{{ card.title }}</p>
            <p class="mt-2 text-3xl font-semibold text-text-primary">
              {{ loading ? '…' : card.value.toLocaleString('it-IT') }}
            </p>
            <p class="mt-3 text-sm leading-6 text-text-secondary">{{ card.description }}</p>
          </div>

          <router-link :to="card.to" class="inline-flex text-sm font-medium text-primary hover:underline">
            Apri sezione
          </router-link>
        </div>
      </article>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1.4fr),minmax(320px,0.9fr)]">
      <section class="card">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-text-primary">Storico invii recente</h2>
            <p class="mt-1 text-sm text-text-secondary">Ultime campagne eseguite o preparate.</p>
          </div>
          <router-link to="/communications/campaigns" class="text-sm font-medium text-primary hover:underline">
            Vai alle campagne
          </router-link>
        </div>

        <div v-if="loading" class="mt-5 text-sm text-text-secondary">Caricamento campagne...</div>
        <div
          v-else-if="!recentCampaigns.length"
          class="mt-5 rounded-2xl border border-dashed border-ui-border px-4 py-8 text-center text-sm text-text-secondary"
        >
          Nessuna campagna registrata.
        </div>
        <div v-else class="mt-5 space-y-3">
          <article
            v-for="campaign in recentCampaigns"
            :key="campaign.id"
            class="rounded-2xl border border-ui-border px-4 py-4"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-base font-semibold text-text-primary">{{ campaign.name }}</p>
                  <span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', getCampaignStatusBadge(campaign.status)]">
                    {{ campaign.status }}
                  </span>
                </div>
                <p class="mt-1 text-sm text-text-secondary">{{ campaign.subject }}</p>
              </div>
              <div class="text-sm text-text-secondary">
                {{ formatDateTime(campaign.sentAt || campaign.createdAt) }}
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2 text-xs">
              <span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                {{ campaign.recipientsCount }} destinatari
              </span>
              <span class="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
                {{ campaign.sentCount }} inviati
              </span>
              <span class="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
                {{ campaign.failedCount }} errori
              </span>
            </div>
          </article>
        </div>
      </section>

      <section class="card">
        <h2 class="text-lg font-semibold text-text-primary">Salute del database consensi</h2>
        <p class="mt-1 text-sm text-text-secondary">
          Vista rapida sulle preferenze attive e sulle situazioni che richiedono attenzione.
        </p>

        <div class="mt-5 space-y-3">
          <div class="rounded-2xl bg-emerald-50 px-4 py-4">
            <p class="text-sm font-medium text-emerald-800">Consensi positivi</p>
            <p class="mt-2 text-2xl font-semibold text-emerald-900">{{ loading ? '…' : summary.accepted }}</p>
          </div>

          <div class="rounded-2xl bg-amber-50 px-4 py-4">
            <p class="text-sm font-medium text-amber-800">Conferme pendenti</p>
            <p class="mt-2 text-2xl font-semibold text-amber-900">{{ loading ? '…' : summary.pendingConfirmations }}</p>
          </div>

          <div class="rounded-2xl bg-slate-100 px-4 py-4">
            <p class="text-sm font-medium text-slate-700">Impostazioni iscrizione</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              Testi privacy, formule e versioni restano gestiti nella sezione legal.
            </p>
            <router-link to="/settings/legal/privacy" class="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
              Apri configurazione
            </router-link>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
