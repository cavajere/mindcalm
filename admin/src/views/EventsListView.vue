<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { getPublicAppUrl } from '../utils/appUrls'

const router = useRouter()
const events = ref<any[]>([])
const loading = ref(true)

function visibilityLabel(visibility: string) {
  return visibility === 'PUBLIC' ? 'Pubblico' : 'Registrati'
}

function visibilityClasses(visibility: string) {
  return visibility === 'PUBLIC'
    ? 'bg-sky-100 text-sky-700'
    : 'bg-slate-100 text-slate-700'
}

async function fetchEvents() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/admin/events?limit=50')
    events.value = data.data
  } finally {
    loading.value = false
  }
}

async function toggleStatus(eventItem: any) {
  const newStatus = eventItem.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
  await axios.patch(`/api/admin/events/${eventItem.id}/status`, { status: newStatus, publicBaseUrl: getPublicAppUrl() })
  eventItem.status = newStatus
}

async function deleteEvent(eventItem: any) {
  if (!confirm(`Eliminare l'evento "${eventItem.title}"?`)) return
  await axios.delete(`/api/admin/events/${eventItem.id}`)
  events.value = events.value.filter((item) => item.id !== eventItem.id)
}

onMounted(fetchEvents)
</script>

<template>
  <div>
    <PageHeader
      title="Eventi"
      description="Gestisci calendario, stato editoriale e visibilita' lato portale utente."
    >
      <template #actions>
        <router-link to="/events/new" class="btn-primary">+ Nuovo evento</router-link>
      </template>
    </PageHeader>

    <div class="table-container">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Titolo</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Citta'</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Inizio</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Stato</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Visibilita'</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Partecipazione</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Prenotazioni</th>
            <th class="table-actions-header px-4 py-3 text-xs font-medium text-text-secondary uppercase">Azioni</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="eventItem in events" :key="eventItem.id" class="hover:bg-gray-50/50">
            <td class="px-4 py-3 text-sm font-medium text-text-primary">{{ eventItem.title }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ eventItem.city }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">
              {{ new Date(eventItem.startsAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
            </td>
            <td class="px-4 py-3">
              <StatusBadge :status="eventItem.status" @click="toggleStatus(eventItem)" class="cursor-pointer" />
            </td>
            <td class="px-4 py-3">
              <span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', visibilityClasses(eventItem.visibility)]">
                {{ visibilityLabel(eventItem.visibility) }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary">
              <span
                :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', eventItem.participationMode === 'PAID' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700']"
              >
                {{ eventItem.participationMode === 'PAID' ? `A pagamento € ${(eventItem.participationPriceCents / 100).toFixed(2)}` : 'Gratuita' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary">
              <div v-if="eventItem.bookingEnabled" class="space-y-1">
                <span class="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Prenotazioni attive
                </span>
                <p>{{ eventItem.bookingReservedSeats }}/{{ eventItem.bookingCapacity || 0 }} occupati</p>
              </div>
              <span v-else class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Disattive
              </span>
            </td>
            <td class="table-actions-cell">
              <div class="table-actions-group">
                <button
                  @click="router.push(`/events/${eventItem.id}/bookings`)"
                  class="icon-action-button icon-action-button-neutral"
                  title="Prenotazioni"
                  aria-label="Prenotazioni"
                >
                  <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z"/>
                  </svg>
                </button>
                <button
                  @click="router.push(`/events/${eventItem.id}/edit`)"
                  class="icon-action-button icon-action-button-neutral"
                  title="Modifica"
                  aria-label="Modifica"
                >
                  <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button
                  @click="deleteEvent(eventItem)"
                  class="icon-action-button icon-action-button-danger"
                  title="Elimina"
                  aria-label="Elimina"
                >
                  <svg class="w-4 h-4 text-red-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!events.length && !loading">
            <td colspan="8" class="px-4 py-8 text-center text-text-secondary">Nessun evento</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
