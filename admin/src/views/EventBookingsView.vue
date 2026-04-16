<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const reconciling = ref(false)
const summary = ref<any>(null)

function formatDateTime(value?: string | null) {
  if (!value) return 'Non disponibile'
  return new Date(value).toLocaleString('it-IT')
}

async function loadBookings() {
  loading.value = true
  error.value = ''

  try {
    const { data } = await axios.get(`/api/admin/events/${route.params.id}/bookings`)
    summary.value = data
  } catch (apiError: any) {
    error.value = apiError.response?.data?.error || 'Errore caricamento prenotazioni'
  } finally {
    loading.value = false
  }
}

async function cancelBooking(booking: any) {
  if (!confirm(`Annullare la prenotazione di ${booking.bookerFirstName} ${booking.bookerLastName}?`)) return
  await axios.post(`/api/admin/events/${route.params.id}/bookings/${booking.id}/cancel`)
  await loadBookings()
}

async function restoreBooking(booking: any) {
  if (!confirm(`Ripristinare la prenotazione di ${booking.bookerFirstName} ${booking.bookerLastName}?`)) return
  await axios.post(`/api/admin/events/${route.params.id}/bookings/${booking.id}/restore`)
  await loadBookings()
}

async function reconcileBookings() {
  reconciling.value = true
  try {
    await axios.post(`/api/admin/events/${route.params.id}/bookings/reconcile`)
    await loadBookings()
  } finally {
    reconciling.value = false
  }
}

onMounted(loadBookings)
</script>

<template>
  <div>
    <PageHeader
      :title="summary?.event?.title || 'Prenotazioni evento'"
      description="Controlla capienza, invitati e prenotazioni confermate o annullate."
    >
      <template #actions>
        <button type="button" class="btn-secondary" :disabled="reconciling" @click="reconcileBookings">
          {{ reconciling ? 'Riallineamento...' : 'Riallinea posti' }}
        </button>
        <button type="button" class="btn-secondary" @click="router.push(`/events/${route.params.id}/edit`)">Evento</button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{{ error }}</div>
    <div v-if="loading" class="text-sm text-text-secondary">Caricamento prenotazioni...</div>

    <template v-else-if="summary">
      <div class="grid gap-4 md:grid-cols-4">
        <div class="card">
          <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Capienza</p>
          <p class="mt-2 text-2xl font-semibold text-text-primary">{{ summary.event.bookingCapacity || 0 }}</p>
        </div>
        <div class="card">
          <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Posti occupati</p>
          <p class="mt-2 text-2xl font-semibold text-text-primary">{{ summary.event.bookingReservedSeats }}</p>
        </div>
        <div class="card">
          <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Posti residui</p>
          <p class="mt-2 text-2xl font-semibold text-text-primary">{{ summary.event.bookingRemainingSeats }}</p>
        </div>
        <div class="card">
          <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Stato</p>
          <p class="mt-2 text-sm font-medium text-text-primary">
            {{ summary.event.bookingEnabled ? (summary.event.bookingAvailable ? 'Aperte' : 'Chiuse o complete') : 'Disattive' }}
          </p>
        </div>
      </div>

      <div class="mt-6 table-container">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Prenotante</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Telefono</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Posti</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Partecipanti</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Stato</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Invito</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Creata</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Azioni</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-if="!summary.bookings.length">
              <td colspan="8" class="px-4 py-8 text-center text-text-secondary">Nessuna prenotazione</td>
            </tr>
            <tr v-for="booking in summary.bookings" :key="booking.id">
              <td class="px-4 py-3 text-sm font-medium text-text-primary">
                {{ booking.bookerFirstName }} {{ booking.bookerLastName }}
              </td>
              <td class="px-4 py-3 text-sm text-text-secondary">{{ booking.bookerPhone }}</td>
              <td class="px-4 py-3 text-sm text-text-secondary">{{ booking.seatsReserved }}</td>
              <td class="px-4 py-3 text-sm text-text-secondary">
                <div class="space-y-1">
                  <div v-for="participant in booking.participants" :key="participant.id">
                    {{ participant.firstName }} {{ participant.lastName }}<span v-if="participant.isBooker"> · referente</span>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-sm">
                <span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', booking.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700']">
                  {{ booking.status === 'CONFIRMED' ? 'Confermata' : 'Annullata' }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-text-secondary">
                <div>{{ booking.invitation.recipientEmail }}</div>
                <div class="text-xs">Scade: {{ formatDateTime(booking.invitation.expiresAt) }}</div>
              </td>
              <td class="px-4 py-3 text-sm text-text-secondary">{{ formatDateTime(booking.createdAt) }}</td>
              <td class="px-4 py-3 text-sm">
                <button
                  v-if="booking.status === 'CONFIRMED'"
                  type="button"
                  class="btn-secondary"
                  @click="cancelBooking(booking)"
                >
                  Annulla
                </button>
                <button
                  v-else
                  type="button"
                  class="btn-secondary"
                  @click="restoreBooking(booking)"
                >
                  Ripristina
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
