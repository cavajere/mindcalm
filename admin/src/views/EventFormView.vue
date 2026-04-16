<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import TiptapEditor from '../components/TiptapEditor.vue'
import AlbumImagePicker from '../components/AlbumImagePicker.vue'
import FileUploader, { type ExistingFileMeta, type UploadFileItem } from '../components/FileUploader.vue'
import type { AlbumImage } from '../types/album'
import { getPublicAppUrl } from '../utils/appUrls'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const saving = ref(false)
const uploadProgress = ref(0)
const error = ref('')

const form = ref({
  title: '',
  organizer: '',
  city: '',
  venue: '',
  excerpt: '',
  body: '',
  startsAt: '',
  endsAt: '',
  status: 'DRAFT',
  visibility: 'REGISTERED',
  bookingEnabled: false,
  bookingCapacity: '',
  bookingOpensAt: '',
  bookingClosesAt: '',
  participationMode: 'FREE',
  participationPrice: '',
})

const coverFiles = ref<UploadFileItem[]>([])
const existingCover = ref<ExistingFileMeta | null>(null)
const existingAlbumCover = ref<AlbumImage | null>(null)
const selectedAlbumImage = ref<AlbumImage | null>(null)
const coverImageDisplayName = ref('')
const removeExistingCover = ref(false)

const effectiveAlbumCover = computed(() => {
  if (removeExistingCover.value) return null
  return selectedAlbumImage.value ?? existingAlbumCover.value
})

const showDirectUploadExisting = computed(() => {
  if (coverFiles.value.length) return null
  if (effectiveAlbumCover.value) return null
  if (removeExistingCover.value) return null
  return existingCover.value
})

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
  return localDate.toISOString().slice(0, 16)
}

function handleAlbumImageSelect(image: AlbumImage) {
  selectedAlbumImage.value = image
  coverFiles.value = []
  coverImageDisplayName.value = ''
  removeExistingCover.value = false
}

function removeCover() {
  if (coverFiles.value.length) {
    coverFiles.value = []
    if (existingCover.value || existingAlbumCover.value) {
      coverImageDisplayName.value = existingCover.value?.displayName || ''
      removeExistingCover.value = false
      return
    }
  }

  if (selectedAlbumImage.value) {
    selectedAlbumImage.value = null
    if (existingCover.value || existingAlbumCover.value) {
      coverImageDisplayName.value = existingCover.value?.displayName || ''
      removeExistingCover.value = false
      return
    }
  }

  coverFiles.value = []
  coverImageDisplayName.value = ''
  if (existingCover.value || existingAlbumCover.value) {
    removeExistingCover.value = true
  }
}

function handleCoverFilesUpdate(files: UploadFileItem[]) {
  coverFiles.value = files
  if (files.length) {
    coverImageDisplayName.value = files[0].displayName
    selectedAlbumImage.value = null
    removeExistingCover.value = false
  } else if (existingCover.value) {
    coverImageDisplayName.value = existingCover.value.displayName
  } else {
    coverImageDisplayName.value = ''
  }
}

async function save() {
  error.value = ''
  saving.value = true
  uploadProgress.value = 0

  try {
    const fd = new FormData()
    fd.append('title', form.value.title)
    fd.append('organizer', form.value.organizer)
    fd.append('city', form.value.city)
    fd.append('venue', form.value.venue)
    fd.append('excerpt', form.value.excerpt)
    fd.append('body', form.value.body)
    fd.append('startsAt', form.value.startsAt)
    fd.append('endsAt', form.value.endsAt)
    fd.append('status', form.value.status)
    fd.append('visibility', form.value.visibility)
    fd.append('bookingEnabled', String(form.value.bookingEnabled))
    fd.append('bookingCapacity', form.value.bookingCapacity)
    fd.append('bookingOpensAt', form.value.bookingOpensAt)
    fd.append('bookingClosesAt', form.value.bookingClosesAt)
    fd.append('participationMode', form.value.participationMode)
    fd.append('participationPrice', form.value.participationPrice)
    fd.append('publicBaseUrl', getPublicAppUrl())
    fd.append('coverImageDisplayName', coverFiles.value.length ? coverFiles.value[0].displayName : coverImageDisplayName.value)

    if (coverFiles.value.length) fd.append('coverImage', coverFiles.value[0].file)
    if (selectedAlbumImage.value) fd.append('coverAlbumImageId', selectedAlbumImage.value.id)
    if (removeExistingCover.value) fd.append('removeCoverImage', 'true')

    const config = {
      onUploadProgress: (event: any) => {
        if (event.total) {
          uploadProgress.value = Math.round((event.loaded / event.total) * 100)
        }
      },
    }

    if (isEdit.value) {
      await axios.put(`/api/admin/events/${route.params.id}`, fd, config)
    } else {
      await axios.post('/api/admin/events', fd, config)
    }

    router.push('/events')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore nel salvataggio'
  } finally {
    saving.value = false
    uploadProgress.value = 0
  }
}

onMounted(async () => {
  if (!isEdit.value) return

  loading.value = true
  try {
    const { data: eventItem } = await axios.get(`/api/admin/events/${route.params.id}`)
    form.value = {
      title: eventItem.title,
      organizer: eventItem.organizer,
      city: eventItem.city,
      venue: eventItem.venue || '',
      excerpt: eventItem.excerpt || '',
      body: eventItem.body,
      startsAt: toLocalDateTimeInput(eventItem.startsAt),
      endsAt: toLocalDateTimeInput(eventItem.endsAt),
      status: eventItem.status,
      visibility: eventItem.visibility,
      bookingEnabled: Boolean(eventItem.bookingEnabled),
      bookingCapacity: eventItem.bookingCapacity ? String(eventItem.bookingCapacity) : '',
      bookingOpensAt: toLocalDateTimeInput(eventItem.bookingOpensAt),
      bookingClosesAt: toLocalDateTimeInput(eventItem.bookingClosesAt),
      participationMode: eventItem.participationMode || 'FREE',
      participationPrice: eventItem.participationPriceCents != null ? (eventItem.participationPriceCents / 100).toFixed(2) : '',
    }
    existingAlbumCover.value = eventItem.coverAlbumImage || null
    existingCover.value = eventItem.coverAlbumImage
      ? null
      : eventItem.coverImage
        ? {
            url: eventItem.coverImage,
            originalName: eventItem.coverImageOriginalName || '',
            displayName: eventItem.coverImageDisplayName || '',
          }
        : null
    selectedAlbumImage.value = null
    coverImageDisplayName.value = eventItem.coverAlbumImage ? '' : (eventItem.coverImageDisplayName || '')
    removeExistingCover.value = false
  } finally {
    loading.value = false
  }
})

watch(
  () => form.value.participationMode,
  (mode) => {
    if (mode !== 'PAID') {
      form.value.participationPrice = ''
    }
  },
)
</script>

<template>
  <div class="mx-auto w-full max-w-3xl">
    <PageHeader
      :title="isEdit ? 'Modifica evento' : 'Nuovo evento'"
      :description="isEdit ? 'Aggiorna programma, visibilita e metadata.' : 'Crea un nuovo evento per il portale utente.'"
    >
      <template #actions>
        <button v-if="isEdit" type="button" @click="router.push(`/events/${route.params.id}/bookings`)" class="btn-secondary">Prenotazioni</button>
        <button type="button" @click="router.push('/events')" class="btn-secondary">Annulla</button>
      </template>
    </PageHeader>

    <form @submit.prevent="save" class="card w-full space-y-5">
      <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{{ error }}</div>

      <div v-if="loading" class="text-sm text-text-secondary">Caricamento evento...</div>

      <template v-else>
        <div>
          <label class="label">Titolo *</label>
          <input v-model="form.title" type="text" required class="input-field" />
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label class="label">Organizzatore *</label>
            <input v-model="form.organizer" type="text" required class="input-field" />
          </div>
          <div>
            <label class="label">Citta' *</label>
            <input v-model="form.city" type="text" required class="input-field" />
          </div>
          <div>
            <label class="label">Venue</label>
            <input v-model="form.venue" type="text" class="input-field" />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="label">Inizio *</label>
            <input v-model="form.startsAt" type="datetime-local" required class="input-field" />
          </div>
          <div>
            <label class="label">Fine</label>
            <input v-model="form.endsAt" type="datetime-local" class="input-field" />
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <label class="label mb-0">Prenotazioni online</label>
              <p class="mt-1 text-xs text-text-secondary">Mostra la disponibilita sul portale pubblico senza esporre il numero di posti residui.</p>
            </div>
            <label class="inline-flex items-center gap-3 text-sm font-medium text-text-primary">
              <input v-model="form.bookingEnabled" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary/30" />
              Attive
            </label>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-3" :class="{ 'opacity-60': !form.bookingEnabled }">
            <div>
              <label class="label">Capienza</label>
              <input v-model="form.bookingCapacity" type="number" min="1" class="input-field" :disabled="!form.bookingEnabled" />
            </div>
            <div>
              <label class="label">Apertura prenotazioni</label>
              <input v-model="form.bookingOpensAt" type="datetime-local" class="input-field" :disabled="!form.bookingEnabled" />
            </div>
            <div>
              <label class="label">Chiusura prenotazioni</label>
              <input v-model="form.bookingClosesAt" type="datetime-local" class="input-field" :disabled="!form.bookingEnabled" />
            </div>
          </div>

          <p class="text-xs text-text-secondary">
            Se la chiusura non e specificata, le prenotazioni si chiudono all'inizio dell'evento. Ogni prenotazione puo includere fino a 5 persone.
          </p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
          <div>
            <label class="label mb-0">Partecipazione</label>
            <p class="mt-1 text-xs text-text-secondary">Indica se l'evento e gratuito o a pagamento e, in quel caso, il costo.</p>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="label">Modalita'</label>
              <select v-model="form.participationMode" class="input-field">
                <option value="FREE">Gratuita</option>
                <option value="PAID">A pagamento</option>
              </select>
            </div>
            <div>
              <label class="label">Costo in euro</label>
              <input
                v-model="form.participationPrice"
                type="number"
                min="0"
                step="0.01"
                class="input-field"
                :disabled="form.participationMode !== 'PAID'"
                placeholder="0,00"
              />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="label">Stato</label>
            <select v-model="form.status" class="input-field">
              <option value="DRAFT">Bozza</option>
              <option value="PUBLISHED">Pubblicato</option>
            </select>
          </div>
          <div>
            <label class="label">Visibilita'</label>
            <select v-model="form.visibility" class="input-field">
              <option value="REGISTERED">Solo utenti registrati</option>
              <option value="PUBLIC">Pubblico</option>
            </select>
          </div>
        </div>

        <div>
          <label class="label">Estratto (max 300 caratteri)</label>
          <textarea v-model="form.excerpt" rows="2" maxlength="300" class="input-field"></textarea>
          <p class="text-xs text-text-secondary mt-1">{{ form.excerpt.length }}/300</p>
        </div>

        <div>
          <label class="label">Contenuto *</label>
          <TiptapEditor v-model="form.body" />
        </div>

        <div>
          <label class="label">Immagine copertina</label>
          <AlbumImagePicker
            :selected-image="effectiveAlbumCover"
            @select="handleAlbumImageSelect"
            @clear="removeCover"
          />

          <div class="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
            <div>
              <p class="text-sm font-medium text-text-primary">Upload diretto</p>
              <p class="mt-1 text-xs text-text-secondary">Usalo se la copertina non deve entrare nell'album condiviso.</p>
            </div>

            <div class="mt-4">
              <FileUploader
                :model-value="coverFiles"
                @update:model-value="handleCoverFilesUpdate"
                accept="image/jpeg,image/png,image/webp"
                accept-label="JPEG, PNG, WebP"
                :max-size-mb="5"
                icon="image"
                show-display-name
                :existing-file="showDirectUploadExisting"
                :progress="uploadProgress"
                :uploading="saving"
                @remove-existing="removeCover"
              />
            </div>

            <div v-if="effectiveAlbumCover" class="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              La copertina viene letta dall'album condiviso.
            </div>

            <div v-else-if="removeExistingCover" class="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              La copertina verrà rimossa al salvataggio.
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3">
          <button type="button" @click="router.push('/events')" class="btn-secondary">Annulla</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Salvataggio...' : (isEdit ? 'Salva modifiche' : 'Crea evento') }}
          </button>
        </div>
      </template>
    </form>
  </div>
</template>
