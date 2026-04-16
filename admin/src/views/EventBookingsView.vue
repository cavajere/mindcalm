<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import { useToast } from '../composables/useToast'
import { getApiErrorMessage } from '../utils/apiMessages'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const loading = ref(true)
const reconciling = ref(false)
const summary = ref<any>(null)

function countRegistrations(status: 'PENDING' | 'CONFIRMED' | 'CANCELLED') {
  return summary.value?.registrations?.filter((registration: any) => registration.registrationStatus === status).length || 0
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Non disponibile'
  return new Date(value).toLocaleString('it-IT')
}

async function loadBookings() {
  loading.value = true
  try {
    const { data } = await axios.get(`/api/admin/events/${route.params.id}/bookings`)
    summary.value = data
  } catch (e: unknown) {
    toast.error(getApiErrorMessage(e, 'Errore caricamento prenotazioni'))
  } finally {
    loading.value = false
  }
}

async function cancelBooking(booking: any) {
  if (!confirm(`Annullare la prenotazione di ${booking.bookerFirstName} ${booking.bookerLastName}?`)) return
  try {
    await axios.post(`/api/admin/events/${route.params.id}/bookings/${booking.id}/cancel`)
    toast.success('Prenotazione annullata')
    await loadBookings()
  } catch (e: unknown) {
    toast.error(getApiErrorMessage(e, 'Errore annullamento prenotazione'))
  }
}

async function restoreBooking(booking: any) {
  if (!confirm(`Ripristinare la prenotazione di ${booking.bookerFirstName} ${booking.bookerLastName}?`)) return
  try {
    await axios.post(`/api/admin/events/${route.params.id}/bookings/${booking.id}/restore`)
    toast.success('Prenotazione ripristinata')
    await loadBookings()
  } catch (e: unknown) {
    toast.error(getApiErrorMessage(e, 'Errore ripristino prenotazione'))
  }
}

async function reconcileBookings() {
  reconciling.value = true
  try {
    await axios.post(`/api/admin/events/${route.params.id}/bookings/reconcile`)
    toast.success('Posti riallineati')
    await loadBookings()
  } catch (e: unknown) {
    toast.error(getApiErrorMessage(e, 'Errore riallineamento posti'))
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
      description="Controlla capienza, richieste ricevute e registrazioni confermate."
    >
      <template #actions>
        <button type="button" class="btn-secondary" :disabled="reconciling" @click="reconcileBookings">
          {{ reconciling ? 'Riallineamento...' : 'Riallinea posti' }}
        </button>
        <button type="button" class="btn-secondary" @click="router.push(`/events/${route.params.id}/edit`)">Evento</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="text-sm text-text-secondary">Caricamento prenotazioni...</div>

    <template v-else-if="summary">
      <div class="grid gap-4 md:grid-cols-5">
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
            {{ summary.event.bookingRequired ? (summary.event.bookingAvailable ? 'Aperte' : 'Chiuse o complete') : 'Senza prenotazione' }}
          </p>
        </div>
        <div class="card">
          <p class="text-xs uppercase tracking-[0.18em] text-text-secondary">Richieste</p>
          <p class="mt-2 text-sm font-medium text-text-primary">
            {{ countRegistrations('PENDING') }} non confermate · {{ countRegistrations('CONFIRMED') }} confermate
          </p>
        </div>
      </div>

      <div class="mt-6 table-container">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Richiedente</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Registrazione</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Note</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Dettagli</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Invio email</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Creata</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Azioni</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-if="!summary.registrations.length">
              <td colspan="7" class="px-4 py-8 text-center text-text-secondary">Nessuna richiesta di registrazione</td>
            </tr>
            <tr v-for="registration in summary.registrations" :key="registration.id">
              <td class="px-4 py-3 text-sm font-medium text-text-primary">
                <div>{{ registration.recipientFirstName || registration.recipientName || 'Richiesta senza nome' }} {{ registration.recipientLastName || '' }}</div>
                <div class="text-xs font-normal text-text-secondary">{{ registration.recipientEmail }}</div>
                <div v-if="registration.recipientPhone" class="text-xs font-normal text-text-secondary">{{ registration.recipientPhone }}</div>
              </td>
              <td class="px-4 py-3 text-sm">
                <span
                  :class="[
                    'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                    registration.registrationStatus === 'CONFIRMED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : registration.registrationStatus === 'CANCELLED'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700',
                  ]"
                >
                  {{
                    registration.registrationStatus === 'CONFIRMED'
                      ? 'Confermata'
                      : registration.registrationStatus === 'CANCELLED'
                        ? 'Annullata'
                        : 'Non confermata'
                  }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-text-secondary">
                {{ registration.note || '—' }}
              </td>
              <td class="px-4 py-3 text-sm text-text-secondary">
                <div v-if="registration.booking" class="space-y-2">
                  <div>{{ registration.booking.seatsReserved }} posti riservati</div>
                  <div class="space-y-1">
                    <div v-for="participant in registration.booking.participants" :key="participant.id">
                      {{ participant.firstName }} {{ participant.lastName }}<span v-if="participant.isBooker"> · referente</span>
                    </div>
                  </div>
                </div>
                <div v-else>In attesa di conferma via email</div>
              </td>
              <td class="px-4 py-3 text-sm text-text-secondary">
                <div v-if="registration.lastSentAt">Inviata: {{ formatDateTime(registration.lastSentAt) }}</div>
                <div class="text-xs">Scade: {{ formatDateTime(registration.expiresAt) }}</div>
              </td>
              <td class="px-4 py-3 text-sm text-text-secondary">{{ formatDateTime(registration.createdAt) }}</td>
              <td class="px-4 py-3 text-sm">
                <button
                  v-if="registration.booking?.status === 'CONFIRMED'"
                  type="button"
                  class="btn-secondary"
                  @click="cancelBooking(registration.booking)"
                >
                  Annulla
                </button>
                <button
                  v-else-if="registration.booking?.status === 'CANCELLED'"
                  type="button"
                  class="btn-secondary"
                  @click="restoreBooking(registration.booking)"
                >
                  Ripristina
                </button>
                <span v-else class="text-text-secondary">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
