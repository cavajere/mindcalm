<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import axios from 'axios'
import CommunicationSectionTabs from '../components/CommunicationSectionTabs.vue'
import PageHeader from '../components/PageHeader.vue'
import { getApiErrorMessage } from '../utils/apiMessages'

type SuppressionItem = {
  id: string
  email: string
  status: 'SUPPRESSED'
  suppressedAt: string | null
  suppressionReason: string | null
  createdAt: string
}

const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const success = ref('')
const searchQuery = ref('')
const items = ref<SuppressionItem[]>([])
const pagination = ref({ page: 1, limit: 25, total: 0, totalPages: 0 })
const dialogOpen = ref(false)
const form = ref({
  email: '',
  reason: 'manual',
})

function formatDateTime(value: string | null) {
  if (!value) return 'n/d'
  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function resetMessages() {
  error.value = ''
  success.value = ''
}

function resetForm() {
  form.value = {
    email: '',
    reason: 'manual',
  }
}

async function fetchItems(page = pagination.value.page) {
  loading.value = true

  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pagination.value.limit),
    })
    if (searchQuery.value.trim()) params.set('search', searchQuery.value.trim())

    const { data } = await axios.get(`/api/admin/communications/suppressions?${params.toString()}`)
    items.value = Array.isArray(data.items) ? data.items : []
    pagination.value = {
      page: data.page ?? page,
      limit: data.limit ?? pagination.value.limit,
      total: data.total ?? 0,
      totalPages: Math.max(1, Math.ceil((data.total ?? 0) / (data.limit ?? pagination.value.limit))),
    }
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Caricamento suppression list fallito')
  } finally {
    loading.value = false
  }
}

async function submitSuppression() {
  if (!form.value.email.trim()) {
    error.value = 'Inserisci un indirizzo email'
    return
  }

  submitting.value = true
  resetMessages()

  try {
    await axios.post('/api/admin/communications/suppressions', {
      email: form.value.email.trim(),
      reason: form.value.reason,
    })
    success.value = 'Indirizzo aggiunto alla suppression list'
    dialogOpen.value = false
    resetForm()
    await fetchItems(1)
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Salvataggio suppression fallito')
  } finally {
    submitting.value = false
  }
}

async function removeSuppression(item: SuppressionItem) {
  if (!window.confirm(`Riattivare ${item.email}?`)) return

  resetMessages()

  try {
    await axios.delete(`/api/admin/communications/suppressions/${item.id}`)
    success.value = 'Indirizzo rimosso dalla suppression list'
    await fetchItems()
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Rimozione suppression fallita')
  }
}

let searchTimer: number | undefined
watch(searchQuery, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    void fetchItems(1)
  }, 250)
})

onMounted(fetchItems)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Suppressions"
      description="Esclusioni manuali e destinatari che non devono ricevere comunicazioni."
    >
      <template #actions>
        <button type="button" class="btn-primary" @click="dialogOpen = true">
          Aggiungi email
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

    <section class="card">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr),220px] lg:items-end">
        <div>
          <label class="label">Cerca</label>
          <input v-model="searchQuery" type="text" class="input-field" placeholder="Cerca email esclusa" />
        </div>
        <div class="rounded-2xl bg-slate-100 px-4 py-3">
          <p class="text-sm text-text-secondary">Totale esclusioni</p>
          <p class="mt-1 text-2xl font-semibold text-text-primary">{{ pagination.total.toLocaleString('it-IT') }}</p>
        </div>
      </div>
    </section>

    <div class="table-container bg-white">
      <table class="w-full min-w-[700px]">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Email</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Motivo</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Soppressa il</th>
            <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-text-secondary">Azioni</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-8 text-center text-sm text-text-secondary">Caricamento suppression list...</td>
          </tr>
          <tr v-else-if="!items.length">
            <td colspan="4" class="px-4 py-8 text-center text-sm text-text-secondary">Nessuna email esclusa.</td>
          </tr>
          <tr v-for="item in items" :key="item.id" class="hover:bg-gray-50/70">
            <td class="px-4 py-4 text-sm font-semibold text-text-primary">{{ item.email }}</td>
            <td class="px-4 py-4 text-sm text-text-secondary">{{ item.suppressionReason || 'manual' }}</td>
            <td class="px-4 py-4 text-sm text-text-secondary">{{ formatDateTime(item.suppressedAt || item.createdAt) }}</td>
            <td class="px-4 py-4">
              <div class="flex justify-center">
                <button type="button" class="btn-secondary px-3 py-1.5" @click="removeSuppression(item)">
                  Riattiva
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
        <button type="button" class="btn-secondary" :disabled="pagination.page <= 1 || loading" @click="fetchItems(pagination.page - 1)">
          Precedente
        </button>
        <button type="button" class="btn-secondary" :disabled="pagination.page >= pagination.totalPages || loading" @click="fetchItems(pagination.page + 1)">
          Successiva
        </button>
      </div>
    </div>

    <div
      v-if="dialogOpen"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-8"
      @click.self="dialogOpen = false"
    >
      <div class="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-text-primary">Aggiungi suppression</h2>
            <p class="mt-1 text-sm text-text-secondary">L'indirizzo verrà escluso dagli invii futuri.</p>
          </div>
          <button type="button" class="btn-secondary" @click="dialogOpen = false">Chiudi</button>
        </div>

        <div class="mt-6 space-y-4">
          <div>
            <label class="label">Email</label>
            <input v-model="form.email" type="email" class="input-field" placeholder="utente@example.com" />
          </div>

          <div>
            <label class="label">Motivo</label>
            <select v-model="form.reason" class="input-field">
              <option value="manual">manual</option>
              <option value="complaint">complaint</option>
              <option value="bounce">bounce</option>
              <option value="unsubscribe">unsubscribe</option>
            </select>
          </div>

          <div class="flex justify-end gap-3">
            <button type="button" class="btn-secondary" @click="dialogOpen = false">Annulla</button>
            <button type="button" class="btn-primary" :disabled="submitting" @click="submitSuppression">
              {{ submitting ? 'Salvataggio...' : 'Salva' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
