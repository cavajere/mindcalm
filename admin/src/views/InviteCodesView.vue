<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'

type InviteCodeStatus = 'ACTIVE' | 'REDEEMED' | 'EXPIRED' | 'DISABLED'

interface InviteCodeItem {
  id: string
  code: string
  licenseDurationDays: number
  status: InviteCodeStatus
  expiresAt: string | null
  redeemedAt: string | null
  createdAt: string
  notes: string
  createdBy: { id: string; email: string; name: string } | null
  redeemedBy: { id: string; email: string; name: string } | null
}

const inviteCodes = ref<InviteCodeItem[]>([])
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const success = ref('')
const copiedCode = ref('')
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const filters = ref({
  search: '',
  status: '',
})

const form = ref({
  licenseDurationDays: 365,
  expiresAt: '',
  notes: '',
})

const presets = [
  { label: '30 giorni', value: 30 },
  { label: '90 giorni', value: 90 },
  { label: '180 giorni', value: 180 },
  { label: '365 giorni', value: 365 },
]

const canCreate = computed(() => form.value.licenseDurationDays > 0)

function buildQuery(page = pagination.value.page) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pagination.value.limit),
  })

  if (filters.value.search.trim()) {
    params.set('search', filters.value.search.trim())
  }

  if (filters.value.status) {
    params.set('status', filters.value.status)
  }

  return params.toString()
}

function formatDateTime(value: string | null) {
  if (!value) return 'n/d'
  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatDuration(days: number) {
  if (days % 365 === 0) {
    const years = days / 365
    return years === 1 ? '1 anno' : `${years} anni`
  }

  if (days % 30 === 0) {
    const months = days / 30
    return months === 1 ? '1 mese' : `${months} mesi`
  }

  return `${days} giorni`
}

function getStatusMeta(status: InviteCodeStatus) {
  if (status === 'ACTIVE') {
    return { label: 'Attivo', className: 'bg-emerald-100 text-emerald-700' }
  }

  if (status === 'REDEEMED') {
    return { label: 'Riscattato', className: 'bg-sky-100 text-sky-700' }
  }

  if (status === 'EXPIRED') {
    return { label: 'Scaduto', className: 'bg-amber-100 text-amber-700' }
  }

  return { label: 'Disabilitato', className: 'bg-gray-100 text-text-secondary' }
}

async function fetchInviteCodes(page = pagination.value.page) {
  loading.value = true
  error.value = ''

  try {
    const { data } = await axios.get(`/api/admin/invite-codes?${buildQuery(page)}`)
    inviteCodes.value = data.data
    pagination.value = { ...pagination.value, ...data.pagination }
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore nel caricamento dei codici invito'
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  if (!canCreate.value) return

  submitting.value = true
  error.value = ''
  success.value = ''

  try {
    const { data } = await axios.post('/api/admin/invite-codes', {
      licenseDurationDays: form.value.licenseDurationDays,
      expiresAt: form.value.expiresAt ? new Date(`${form.value.expiresAt}T23:59:59.999`).toISOString() : undefined,
      notes: form.value.notes || undefined,
    })

    success.value = `Codice creato: ${data.code}`
    form.value.notes = ''
    form.value.expiresAt = ''
    await fetchInviteCodes(1)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Creazione codice non riuscita'
  } finally {
    submitting.value = false
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copiedCode.value = code
    success.value = `Codice copiato: ${code}`
    window.setTimeout(() => {
      if (copiedCode.value === code) {
        copiedCode.value = ''
      }
    }, 1500)
  } catch {
    error.value = 'Copia negli appunti non disponibile'
  }
}

async function disableCode(inviteCode: InviteCodeItem) {
  if (!confirm(`Disabilitare il codice "${inviteCode.code}"?`)) return

  error.value = ''
  success.value = ''

  try {
    await axios.post(`/api/admin/invite-codes/${inviteCode.id}/disable`)
    success.value = `Codice ${inviteCode.code} disabilitato`
    await fetchInviteCodes()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Disabilitazione non riuscita'
  }
}

function applyFilters() {
  fetchInviteCodes(1)
}

function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > pagination.value.totalPages) return
  fetchInviteCodes(nextPage)
}

onMounted(() => {
  fetchInviteCodes()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Codici invito</h1>
        <p class="text-sm text-text-secondary mt-1">
          Genera codici monouso per la registrazione self-service degli utenti standard.
        </p>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,360px),minmax(0,1fr)]">
      <div class="card space-y-4">
        <div>
          <h2 class="text-lg font-semibold text-text-primary">Nuovo codice</h2>
          <p class="text-sm text-text-secondary mt-1">
            La durata della licenza parte dalla conferma email dell’utente.
          </p>
        </div>

        <div v-if="success" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
          {{ success }}
        </div>

        <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
          {{ error }}
        </div>

        <div>
          <label class="label">Preset durata</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in presets"
              :key="preset.value"
              type="button"
              class="btn-secondary"
              @click="form.licenseDurationDays = preset.value"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div>
          <label class="label">Durata licenza in giorni</label>
          <input v-model.number="form.licenseDurationDays" min="1" max="3650" type="number" class="input-field" />
        </div>

        <div>
          <label class="label">Scadenza codice</label>
          <input v-model="form.expiresAt" type="date" class="input-field" />
          <p class="text-xs text-text-secondary mt-1">
            Lascia vuoto per un codice senza scadenza temporale.
          </p>
        </div>

        <div>
          <label class="label">Note interne</label>
          <textarea v-model="form.notes" rows="4" maxlength="500" class="input-field" placeholder="Campagna, cliente, contesto..." />
        </div>

        <div class="pt-2">
          <button type="button" :disabled="submitting || !canCreate" class="btn-primary w-full" @click="handleCreate">
            {{ submitting ? 'Creazione...' : 'Genera codice' }}
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <div class="card">
          <div class="grid gap-4 md:grid-cols-[minmax(0,1fr),220px]">
            <div>
              <label class="label">Cerca</label>
              <input
                v-model="filters.search"
                class="input-field"
                placeholder="Codice o note"
                @keydown.enter.prevent="applyFilters"
              />
            </div>

            <div>
              <label class="label">Stato</label>
              <select v-model="filters.status" class="input-field" @change="applyFilters">
                <option value="">Tutti</option>
                <option value="ACTIVE">Attivi</option>
                <option value="REDEEMED">Riscattati</option>
                <option value="EXPIRED">Scaduti</option>
                <option value="DISABLED">Disabilitati</option>
              </select>
            </div>
          </div>
        </div>

        <div class="table-container">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Codice</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Durata</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Stato</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Scadenza codice</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Riscattato da</th>
                <th class="table-actions-header px-4 py-3 text-xs font-medium text-text-secondary uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-if="loading">
                <td colspan="6" class="px-4 py-8 text-center text-text-secondary">Caricamento...</td>
              </tr>
              <tr v-else-if="!inviteCodes.length">
                <td colspan="6" class="px-4 py-8 text-center text-text-secondary">Nessun codice invito</td>
              </tr>
              <tr v-for="inviteCode in inviteCodes" :key="inviteCode.id" class="hover:bg-gray-50/50">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <code class="text-sm font-semibold tracking-[0.2em] text-text-primary">{{ inviteCode.code }}</code>
                    <span v-if="copiedCode === inviteCode.code" class="text-xs text-green-700">Copiato</span>
                  </div>
                  <p class="text-xs text-text-secondary mt-1">
                    Creato il {{ formatDateTime(inviteCode.createdAt) }}
                  </p>
                  <p v-if="inviteCode.notes" class="text-xs text-text-secondary mt-1">{{ inviteCode.notes }}</p>
                </td>
                <td class="px-4 py-3 text-sm text-text-primary">{{ formatDuration(inviteCode.licenseDurationDays) }}</td>
                <td class="px-4 py-3 text-sm">
                  <span :class="['inline-flex px-2 py-1 rounded-full text-xs font-medium', getStatusMeta(inviteCode.status).className]">
                    {{ getStatusMeta(inviteCode.status).label }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-text-secondary">{{ formatDateTime(inviteCode.expiresAt) }}</td>
                <td class="px-4 py-3 text-sm text-text-secondary">
                  <span v-if="inviteCode.redeemedBy">{{ inviteCode.redeemedBy.email }}</span>
                  <span v-else>n/d</span>
                  <p v-if="inviteCode.redeemedAt" class="text-xs mt-1">
                    {{ formatDateTime(inviteCode.redeemedAt) }}
                  </p>
                </td>
                <td class="table-actions-cell">
                  <div class="table-actions-group">
                    <button
                      type="button"
                      class="icon-action-button icon-action-button-neutral"
                      title="Copia codice"
                      aria-label="Copia codice"
                      @click="copyCode(inviteCode.code)"
                    >
                      <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 10h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      v-if="inviteCode.status === 'ACTIVE'"
                      type="button"
                      class="icon-action-button icon-action-button-warning"
                      title="Disabilita"
                      aria-label="Disabilita"
                      @click="disableCode(inviteCode)"
                    >
                      <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-12.728 12.728M6.343 6.343l11.314 11.314" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="pagination.totalPages > 1" class="flex items-center justify-between gap-4">
          <p class="text-sm text-text-secondary">
            Pagina {{ pagination.page }} di {{ pagination.totalPages }}
          </p>

          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">
              Precedente
            </button>
            <button type="button" class="btn-secondary" :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">
              Successiva
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
