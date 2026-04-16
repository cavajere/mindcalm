<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import ContentCover from '../components/ContentCover.vue'
import RichTextRenderer from '../components/RichTextRenderer.vue'

interface EventItem {
  id: string
  slug: string
  title: string
  body: string
  excerpt: string | null
  organizer: string
  city: string
  venue: string | null
  startsAt: string
  endsAt: string | null
  coverImage: string | null
  cancelledAt: string | null
  cancellationMessage: string | null
  bookingRequired: boolean
  bookingAvailable: boolean
  participationMode: 'FREE' | 'PAID'
  participationPriceCents: number | null
}

interface BookingParticipant {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  isBooker: boolean
}

interface BookingSummary {
  id: string
  status: 'CONFIRMED' | 'CANCELLED'
  bookerFirstName: string
  bookerLastName: string
  bookerPhone: string
  seatsReserved: number
  participants: BookingParticipant[]
}

interface BookingInvitationSummary {
  id: string
  recipientEmail: string
  recipientName: string | null
  recipientFirstName: string | null
  recipientLastName: string | null
  recipientPhone: string | null
  note: string | null
  createdAt: string
  lastSentAt: string | null
}

interface BookingAccess {
  accessStatus: 'VALID' | 'INVALID' | 'EXPIRED' | 'REVOKED' | 'BOOKING_CLOSED' | 'SOLD_OUT' | 'BOOKED'
  canBook: boolean
  bookingAvailable: boolean
  maxParticipants: number
  existingBooking: BookingSummary | null
  requiresBookingDetails: boolean
  invitation: BookingInvitationSummary | null
}

const route = useRoute()
const eventItem = ref<EventItem | null>(null)
const loading = ref(true)
const bookingAccess = ref<BookingAccess | null>(null)
const bookingLoading = ref(false)
const bookingRequestSaving = ref(false)
const bookingRequestError = ref('')
const bookingRequestSuccess = ref('')
const bookingSaving = ref(false)
const bookingError = ref('')
const bookingSuccess = ref('')
const bookingRequestForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  note: '',
})
const bookingForm = ref({
  bookerFirstName: '',
  bookerLastName: '',
  bookerPhone: '',
  participants: [] as Array<{ firstName: string; lastName: string }>,
})
const bookingToken = computed(() => typeof route.query.bookingToken === 'string' ? route.query.bookingToken : '')
const isCancelled = computed(() => Boolean(eventItem.value?.cancelledAt))

function scrollToBooking() {
  document.getElementById('prenotazione')?.scrollIntoView({ behavior: 'smooth' })
}

const formattedDate = computed(() => {
  if (!eventItem.value) return ''

  return new Date(eventItem.value.startsAt).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const formattedTime = computed(() => {
  if (!eventItem.value) return ''

  const start = new Date(eventItem.value.startsAt)
  const startLabel = start.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (!eventItem.value.endsAt) {
    return startLabel
  }

  const endLabel = new Date(eventItem.value.endsAt).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${startLabel} - ${endLabel}`
})

const locationLabel = computed(() => {
  if (!eventItem.value) return ''

  return eventItem.value.venue
    ? `${eventItem.value.city} · ${eventItem.value.venue}`
    : eventItem.value.city
})

const bookingStatusLabel = computed(() => {
  if (!eventItem.value?.bookingRequired) return ''
  if (eventItem.value.cancelledAt) return 'Evento annullato'
  return eventItem.value.bookingAvailable ? 'Prenotazioni aperte' : 'Prenotazioni chiuse'
})

const participationLabel = computed(() => {
  if (!eventItem.value) return ''

  const pricePart = eventItem.value.participationMode === 'PAID' && eventItem.value.participationPriceCents != null
    ? `A pagamento · € ${(eventItem.value.participationPriceCents / 100).toFixed(2)}`
    : 'Gratuita'

  const bookingPart = eventItem.value.bookingRequired ? 'con prenotazione' : 'senza prenotazione'

  return `${pricePart} · ${bookingPart}`
})

function addParticipant() {
  const totalPeople = 1 + bookingForm.value.participants.length
  if (bookingAccess.value && totalPeople >= bookingAccess.value.maxParticipants) return
  bookingForm.value.participants.push({ firstName: '', lastName: '' })
}

function removeParticipant(index: number) {
  bookingForm.value.participants.splice(index, 1)
}

function hydrateBookingFormFromInvitation(invitation: BookingInvitationSummary | null) {
  if (!invitation) return

  if (!bookingForm.value.bookerFirstName && invitation.recipientFirstName) {
    bookingForm.value.bookerFirstName = invitation.recipientFirstName
  }
  if (!bookingForm.value.bookerLastName && invitation.recipientLastName) {
    bookingForm.value.bookerLastName = invitation.recipientLastName
  }
  if (!bookingForm.value.bookerPhone && invitation.recipientPhone) {
    bookingForm.value.bookerPhone = invitation.recipientPhone
  }
}

function normalizedGuestsPayload() {
  return bookingForm.value.participants
    .filter((participant) => participant.firstName.trim() || participant.lastName.trim())
    .map((participant) => ({
      firstName: participant.firstName.trim(),
      lastName: participant.lastName.trim(),
    }))
}

async function loadEvent(slug: string) {
  loading.value = true
  eventItem.value = null

  try {
    const { data } = await axios.get(`/api/events/${slug}`)
    eventItem.value = data
  } catch {
    eventItem.value = null
  } finally {
    loading.value = false
  }
}

async function loadBookingAccess(slug: string, token: string) {
  if (!token) {
    bookingAccess.value = null
    bookingError.value = ''
    bookingSuccess.value = ''
    return
  }

  bookingLoading.value = true
  bookingError.value = ''

  try {
    const { data } = await axios.get(`/api/events/${slug}/booking-access`, {
      params: { token },
    })
    bookingAccess.value = data
    hydrateBookingFormFromInvitation(data.invitation || null)
  } catch (error: any) {
    bookingAccess.value = null
    bookingError.value = error.response?.data?.error || 'Impossibile verificare il link di prenotazione'
  } finally {
    bookingLoading.value = false
  }
}

async function submitBookingRequest() {
  if (!eventItem.value) return

  bookingRequestSaving.value = true
  bookingRequestError.value = ''
  bookingRequestSuccess.value = ''

  try {
    const { data } = await axios.post(`/api/events/${eventItem.value.slug}/booking-request`, {
      firstName: bookingRequestForm.value.firstName,
      lastName: bookingRequestForm.value.lastName,
      email: bookingRequestForm.value.email,
      phone: bookingRequestForm.value.phone,
      note: bookingRequestForm.value.note,
    })

    bookingRequestSuccess.value = data.message || 'Ti abbiamo inviato un link di conferma via email.'
  } catch (error: any) {
    bookingRequestError.value = error.response?.data?.error || "Errore durante l'invio del link di conferma"
  } finally {
    bookingRequestSaving.value = false
  }
}

async function submitBooking() {
  if (!eventItem.value || !bookingToken.value) return

  bookingSaving.value = true
  bookingError.value = ''
  bookingSuccess.value = ''

  try {
    await axios.post(`/api/events/${eventItem.value.slug}/bookings`, {
      token: bookingToken.value,
      bookerFirstName: bookingForm.value.bookerFirstName || undefined,
      bookerLastName: bookingForm.value.bookerLastName || undefined,
      bookerPhone: bookingForm.value.bookerPhone || undefined,
      participants: normalizedGuestsPayload(),
    })

    bookingSuccess.value = 'Registrazione confermata correttamente.'
    await loadEvent(eventItem.value.slug)
    await loadBookingAccess(eventItem.value.slug, bookingToken.value)
  } catch (error: any) {
    bookingError.value = error.response?.data?.error || 'Errore durante la prenotazione'
  } finally {
    bookingSaving.value = false
  }
}

watch(
  () => [route.params.slug, bookingToken.value],
  async ([slug, token]) => {
    if (typeof slug === 'string' && slug) {
      bookingRequestError.value = ''
      bookingRequestSuccess.value = ''
      await loadEvent(slug)
      await loadBookingAccess(slug, typeof token === 'string' ? token : '')
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="page-container pb-10">
    <div v-if="loading" class="mx-auto max-w-5xl animate-pulse">
      <div class="skeleton-block mb-4 h-10 w-40 rounded-2xl"></div>

      <div class="surface-card overflow-hidden p-6 sm:p-8 lg:p-10">
        <div class="mb-4 flex gap-3">
          <div class="skeleton-block h-8 w-24 rounded-full"></div>
          <div class="skeleton-block h-8 w-40 rounded-full"></div>
        </div>
        <div class="skeleton-block h-12 w-4/5 rounded-2xl"></div>
        <div class="skeleton-block mt-4 h-6 w-3/5 rounded-xl"></div>
        <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div class="space-y-3">
            <div class="skeleton-block h-4 w-full"></div>
            <div class="skeleton-block h-4 w-5/6"></div>
            <div class="skeleton-block h-4 w-2/3"></div>
          </div>
          <div class="skeleton-block aspect-[4/3] rounded-[28px]"></div>
        </div>
      </div>

      <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div class="surface-card-muted p-8">
          <div class="space-y-4">
            <div class="skeleton-block h-4 w-full"></div>
            <div class="skeleton-block h-4 w-full"></div>
            <div class="skeleton-block h-4 w-5/6"></div>
            <div class="skeleton-block h-4 w-full"></div>
          </div>
        </div>
        <div class="surface-card-muted hidden lg:block"></div>
      </div>
    </div>

    <article v-else-if="eventItem" class="mx-auto max-w-5xl">
      <div class="mb-5">
        <router-link
          to="/events"
          class="btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 19l-7-7 7-7" />
          </svg>
          Tutti gli eventi
        </router-link>
      </div>

      <section class="section-panel relative overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(74,144,217,0.12),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(80,184,96,0.12),_transparent_28%)]" />

        <div
          :class="[
            'relative grid gap-5 p-5 sm:gap-6 sm:p-7 lg:items-start lg:p-8',
            eventItem.coverImage ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : '',
          ]"
        >
          <div class="min-w-0">
            <div class="mb-4 flex flex-wrap items-center gap-2">
              <span class="badge surface-pill text-primary">Evento pubblico</span>
              <span v-if="isCancelled" class="badge surface-pill bg-red-100 text-red-700">
                Evento annullato
              </span>
              <span v-else-if="eventItem.bookingRequired && eventItem.bookingAvailable" class="badge surface-pill bg-emerald-100 text-emerald-700">
                {{ bookingStatusLabel }}
              </span>
              <span v-else-if="eventItem.bookingRequired" class="badge surface-pill bg-slate-100 text-slate-700">
                {{ bookingStatusLabel }}
              </span>
            </div>

            <h1 class="max-w-3xl text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
              {{ eventItem.title }}
            </h1>

            <p v-if="eventItem.excerpt" class="mt-3 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
              {{ eventItem.excerpt }}
            </p>

            <div
              v-if="isCancelled"
              :class="eventItem.excerpt ? 'mt-5' : 'mt-3'"
              class="max-w-2xl rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm leading-7 text-red-700"
            >
              <p class="font-semibold text-red-800">Questo evento è stato annullato.</p>
              <p v-if="eventItem.cancellationMessage" class="mt-2">{{ eventItem.cancellationMessage }}</p>
            </div>
          </div>

          <div v-if="eventItem.coverImage">
            <ContentCover
              :src="eventItem.coverImage"
              :alt="eventItem.title"
              container-class="surface-card min-h-[280px] overflow-hidden"
              image-class="aspect-[4/3] h-full w-full object-cover"
            />
          </div>
        </div>
        <div
          :class="eventItem.excerpt || isCancelled ? 'pt-1' : 'pt-0'"
          class="relative px-5 pb-5 sm:px-7 sm:pb-7 lg:px-8 lg:pb-8"
        >
          <div class="max-w-3xl">
            <RichTextRenderer :html="eventItem.body" />
          </div>
        </div>
      </section>

      <section class="mt-8">
        <div class="surface-card-muted p-6 sm:p-8">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">Informazioni pratiche</p>
              <h2 class="mt-2 text-2xl font-semibold tracking-tight text-text-primary">Dove, quando e come partecipare</h2>
            </div>
            <a
              v-if="eventItem.bookingRequired && !isCancelled && eventItem.bookingAvailable"
              href="#prenotazione"
              class="btn-primary inline-flex items-center gap-2"
              @click.prevent="scrollToBooking"
            >
              Prenota il tuo posto
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>

          <dl class="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Dove</dt>
              <dd class="mt-2 text-sm font-semibold leading-6 text-text-primary">{{ locationLabel }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Quando</dt>
              <dd class="mt-2 text-sm leading-6 text-text-primary">
                <span class="font-semibold">{{ formattedDate }}</span>
                <span class="text-text-secondary"> · {{ formattedTime }}</span>
              </dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Costo</dt>
              <dd class="mt-2 text-sm font-semibold leading-6 text-text-primary">
                {{ eventItem.participationMode === 'PAID' && eventItem.participationPriceCents != null
                  ? `€ ${(eventItem.participationPriceCents / 100).toFixed(2)}`
                  : 'Gratuito' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Prenotazione</dt>
              <dd class="mt-2 text-sm font-semibold leading-6 text-text-primary">
                {{ eventItem.bookingRequired ? bookingStatusLabel : 'Non richiesta' }}
              </dd>
            </div>
            <div v-if="eventItem.organizer" class="sm:col-span-2">
              <dt class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Organizzazione</dt>
              <dd class="mt-2 text-sm font-semibold leading-6 text-text-primary">{{ eventItem.organizer }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section v-if="eventItem.bookingRequired && !isCancelled" id="prenotazione" class="mt-8 scroll-mt-8">
        <div class="section-panel p-6 sm:p-8 lg:p-10">
          <div class="mx-auto max-w-xl">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">Prenotazione</p>
            <p class="mt-3 text-xl font-semibold text-text-primary sm:text-2xl">{{ bookingStatusLabel }}</p>
            <p class="mt-2 text-sm leading-7 text-text-secondary">
              {{ eventItem.bookingAvailable
                ? 'Compila il modulo per richiedere la prenotazione. Riceverai un link di conferma via email.'
                : 'Al momento non ci sono prenotazioni disponibili online per questo evento.' }}
            </p>

            <div v-if="bookingToken" class="mt-6 space-y-4">
              <div v-if="bookingLoading" class="text-sm text-text-secondary">Verifica del link in corso...</div>
              <template v-else-if="bookingAccess">
                <div v-if="bookingError" class="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{{ bookingError }}</div>
                <div v-if="bookingSuccess" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ bookingSuccess }}</div>

                <div
                  v-if="bookingAccess.accessStatus === 'VALID' && bookingAccess.canBook && !bookingAccess.requiresBookingDetails && bookingAccess.invitation"
                  class="space-y-4"
                >
                  <div class="rounded-[24px] border border-ui-border bg-surface/90 p-4">
                    <p class="text-sm font-medium text-text-primary">
                      {{ bookingAccess.invitation.recipientFirstName }} {{ bookingAccess.invitation.recipientLastName }}
                    </p>
                    <p class="mt-1 text-sm text-text-secondary">{{ bookingAccess.invitation.recipientEmail }}</p>
                    <p class="mt-1 text-sm text-text-secondary">{{ bookingAccess.invitation.recipientPhone }}</p>
                    <p v-if="bookingAccess.invitation.note" class="mt-3 text-sm leading-7 text-text-secondary">
                      {{ bookingAccess.invitation.note }}
                    </p>
                  </div>

                  <button type="button" class="btn-primary w-full" :disabled="bookingSaving" @click="submitBooking">
                    {{ bookingSaving ? 'Conferma in corso...' : 'Conferma registrazione' }}
                  </button>
                </div>

                <form
                  v-else-if="bookingAccess.accessStatus === 'VALID' && bookingAccess.canBook"
                  class="space-y-4"
                  @submit.prevent="submitBooking"
                >
                  <p class="text-sm text-text-secondary">I campi contrassegnati con * sono obbligatori.</p>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label class="block text-sm font-medium text-text-primary mb-1">Nome referente *</label>
                      <input v-model="bookingForm.bookerFirstName" type="text" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-text-primary mb-1">Cognome referente *</label>
                      <input v-model="bookingForm.bookerLastName" type="text" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-text-primary mb-1">Telefono referente *</label>
                    <input v-model="bookingForm.bookerPhone" type="tel" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                  </div>

                  <div class="space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <p class="text-sm font-medium text-text-primary">Partecipanti aggiuntivi</p>
                      <button
                        type="button"
                        class="btn-secondary text-sm"
                        :disabled="1 + bookingForm.participants.length >= bookingAccess.maxParticipants"
                        @click="addParticipant"
                      >
                        Aggiungi persona
                      </button>
                    </div>

                    <div
                      v-for="(participant, index) in bookingForm.participants"
                      :key="index"
                      class="rounded-[24px] border border-ui-border bg-surface/90 p-4"
                    >
                      <div class="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <input v-model="participant.firstName" type="text" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Nome" />
                        <input v-model="participant.lastName" type="text" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Cognome" />
                        <button type="button" class="btn-secondary text-sm" @click="removeParticipant(index)">Rimuovi</button>
                      </div>
                    </div>
                  </div>

                  <button type="submit" class="btn-primary w-full" :disabled="bookingSaving">
                    {{ bookingSaving ? 'Conferma in corso...' : 'Conferma registrazione' }}
                  </button>

                  <p class="text-sm leading-6 text-text-secondary">
                    I dati raccolti saranno trattati al fine di gestire la partecipazione all'evento. Per maggiori informazioni consulta
                    <router-link to="/privacy-policy" class="text-primary hover:underline">
                      l'informativa privacy
                    </router-link>.
                  </p>
                </form>

                <div v-else-if="bookingAccess.accessStatus === 'BOOKED' && bookingAccess.existingBooking" class="space-y-3">
                  <div class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    Per questo link risulta già una registrazione confermata.
                  </div>
                  <div class="rounded-[24px] border border-ui-border bg-surface/90 p-4">
                    <p class="text-sm font-medium text-text-primary">
                      {{ bookingAccess.existingBooking.bookerFirstName }} {{ bookingAccess.existingBooking.bookerLastName }}
                    </p>
                    <p class="mt-1 text-sm text-text-secondary">{{ bookingAccess.existingBooking.bookerPhone }}</p>
                    <div class="mt-3 space-y-1 text-sm text-text-secondary">
                      <div v-for="participant in bookingAccess.existingBooking.participants" :key="participant.id">
                        {{ participant.firstName }} {{ participant.lastName }}<span v-if="participant.isBooker"> · referente</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {{
                    bookingAccess.accessStatus === 'EXPIRED'
                      ? 'Il link di prenotazione è scaduto.'
                      : bookingAccess.accessStatus === 'REVOKED'
                        ? 'Il link di prenotazione non è più valido.'
                        : bookingAccess.accessStatus === 'SOLD_OUT'
                          ? 'I posti disponibili sono terminati.'
                          : bookingAccess.accessStatus === 'BOOKING_CLOSED'
                            ? 'Le prenotazioni online per questo evento sono chiuse.'
                            : 'Il link di prenotazione non è valido.'
                  }}
                </div>
              </template>
            </div>

            <div v-else-if="eventItem.bookingAvailable" class="mt-6 space-y-4">
              <div v-if="bookingRequestError" class="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{{ bookingRequestError }}</div>
              <div v-if="bookingRequestSuccess" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ bookingRequestSuccess }}</div>

              <form class="space-y-4" @submit.prevent="submitBookingRequest">
                <p class="text-sm text-text-secondary">I campi contrassegnati con * sono obbligatori.</p>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="block text-sm font-medium text-text-primary mb-1">Nome *</label>
                    <input v-model="bookingRequestForm.firstName" type="text" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-text-primary mb-1">Cognome *</label>
                    <input v-model="bookingRequestForm.lastName" type="text" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-primary mb-1">Email *</label>
                  <input v-model="bookingRequestForm.email" type="email" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-primary mb-1">Numero di telefono *</label>
                  <input v-model="bookingRequestForm.phone" type="tel" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-primary mb-1">Note</label>
                  <textarea v-model="bookingRequestForm.note" rows="3" class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Informazioni utili per l'organizzazione"></textarea>
                </div>

                <button type="submit" class="btn-primary w-full" :disabled="bookingRequestSaving">
                  {{ bookingRequestSaving ? 'Invio in corso...' : 'Richiedi link di conferma' }}
                </button>

                <p class="text-sm leading-6 text-text-secondary">
                  I dati raccolti saranno trattati al fine di gestire la partecipazione all'evento. Per maggiori informazioni consulta
                  <router-link to="/privacy-policy" class="text-primary hover:underline">
                    l'informativa privacy
                  </router-link>.
                </p>
              </form>

              <p class="rounded-2xl bg-primary/5 px-4 py-3 text-sm text-text-secondary">
                Ti invieremo un link all'indirizzo email indicato. La registrazione sarà confermata solo dopo l'apertura del link.
              </p>
            </div>
          </div>
        </div>
      </section>
    </article>

    <div v-else class="mx-auto max-w-2xl py-16 text-center">
      <div class="surface-card px-6 py-10">
        <div class="surface-card-muted mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-text-secondary">
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9.172 9.172a4 4 0 115.656 5.656M9 13h.01M15 11h.01M12 6h.01M12 18h.01M6 12h.01M18 12h.01" />
          </svg>
        </div>
        <h2 class="mt-5 text-2xl font-semibold text-text-primary">Evento non disponibile</h2>
        <p class="mt-3 text-base leading-7 text-text-secondary">
          Il contenuto potrebbe essere stato rimosso oppure il link non è corretto.
        </p>
        <router-link to="/events" class="btn-primary mt-6 inline-flex items-center gap-2">
          Torna agli eventi
        </router-link>
      </div>
    </div>
  </div>
</template>
