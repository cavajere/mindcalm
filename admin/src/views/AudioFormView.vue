<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import TagSelector, { type SelectableTag } from '../components/TagSelector.vue'
import AlbumImagePicker from '../components/AlbumImagePicker.vue'
import type { AlbumImage } from '../types/album'
import { audioLevelOptions } from '../utils/audioLevels'

type ExistingFileMeta = {
  url: string | null
  originalName: string
  displayName: string
}

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const saving = ref(false)
const uploadProgress = ref(0)
const error = ref('')
const categories = ref<any[]>([])
const tags = ref<SelectableTag[]>([])

const form = ref({
  title: '',
  description: '',
  categoryId: '',
  level: 'BEGINNER',
  status: 'DRAFT',
  tagIds: [] as string[],
})

// --- Audio ---
const audioFile = ref<File | null>(null)
const existingAudio = ref<ExistingFileMeta | null>(null)
const audioDisplayName = ref('')
const audioDragging = ref(false)
const audioInputRef = ref<HTMLInputElement | null>(null)

const audioAccept = 'audio/mpeg,audio/ogg,audio/wav'
const audioExtensions = ['.mp3', '.ogg', '.wav']

function handleAudioSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) setAudioFile(files[0])
}

function handleAudioDrop(e: DragEvent) {
  audioDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file && isValidAudio(file)) setAudioFile(file)
  else if (file) error.value = 'Formato audio non supportato. Usa MP3, OGG o WAV.'
}

function isValidAudio(file: File): boolean {
  return ['audio/mpeg', 'audio/ogg', 'audio/wav'].includes(file.type) ||
    audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
}

function setAudioFile(file: File) {
  error.value = ''
  const maxMB = 100
  if (file.size > maxMB * 1024 * 1024) {
    error.value = `File audio troppo grande (max ${maxMB} MB)`
    return
  }
  audioFile.value = file
  audioDisplayName.value = file.name
}

function removeAudio() {
  audioFile.value = null
  audioDisplayName.value = existingAudio.value?.displayName || ''
  if (audioInputRef.value) audioInputRef.value.value = ''
}

// --- Cover image ---
const coverImage = ref<File | null>(null)
const existingCover = ref<ExistingFileMeta | null>(null)
const existingAlbumCover = ref<AlbumImage | null>(null)
const selectedAlbumImage = ref<AlbumImage | null>(null)
const coverPreview = ref('')
const coverImageDisplayName = ref('')
const removeExistingCover = ref(false)
const coverDragging = ref(false)
const coverInputRef = ref<HTMLInputElement | null>(null)

const imageAccept = 'image/jpeg,image/png,image/webp'

const effectiveAlbumCover = computed(() => {
  if (removeExistingCover.value) return null
  return selectedAlbumImage.value ?? existingAlbumCover.value
})

function handleCoverSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) setCoverFile(files[0])
}

function handleCoverDrop(e: DragEvent) {
  coverDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file && isValidImage(file)) setCoverFile(file)
  else if (file) error.value = 'Formato immagine non supportato. Usa JPEG, PNG o WebP.'
}

function isValidImage(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
}

function setCoverFile(file: File) {
  error.value = ''
  const maxMB = 5
  if (file.size > maxMB * 1024 * 1024) {
    error.value = `Immagine troppo grande (max ${maxMB} MB)`
    return
  }
  coverImage.value = file
  coverPreview.value = URL.createObjectURL(file)
  coverImageDisplayName.value = file.name
  selectedAlbumImage.value = null
  removeExistingCover.value = false
}

function handleAlbumImageSelect(image: AlbumImage) {
  selectedAlbumImage.value = image
  coverImage.value = null
  coverPreview.value = ''
  coverImageDisplayName.value = ''
  removeExistingCover.value = false
  if (coverInputRef.value) coverInputRef.value.value = ''
}

function removeCover() {
  if (coverImage.value) {
    coverImage.value = null
    coverPreview.value = ''
    if (existingCover.value || existingAlbumCover.value) {
      coverImageDisplayName.value = existingCover.value?.displayName || ''
      removeExistingCover.value = false
      if (coverInputRef.value) coverInputRef.value.value = ''
      return
    }
  }

  if (selectedAlbumImage.value) {
    selectedAlbumImage.value = null
    if (existingCover.value || existingAlbumCover.value) {
      coverImageDisplayName.value = existingCover.value?.displayName || ''
      removeExistingCover.value = false
      if (coverInputRef.value) coverInputRef.value.value = ''
      return
    }
  }

  coverImage.value = null
  coverPreview.value = ''
  coverImageDisplayName.value = ''
  if (existingCover.value || existingAlbumCover.value) {
    removeExistingCover.value = true
  }
  if (coverInputRef.value) coverInputRef.value.value = ''
}

// --- Utils ---
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExtension(name: string): string {
  return name.split('.').pop()?.toUpperCase() || ''
}

// --- Save ---
async function save() {
  error.value = ''
  saving.value = true
  uploadProgress.value = 0

  try {
    const fd = new FormData()
    fd.append('title', form.value.title)
    fd.append('description', form.value.description)
    fd.append('categoryId', form.value.categoryId)
    fd.append('level', form.value.level)
    fd.append('status', form.value.status)
    fd.append('tagIds', JSON.stringify(form.value.tagIds))
    fd.append('audioFileDisplayName', audioDisplayName.value)
    fd.append('coverImageDisplayName', coverImageDisplayName.value)

    if (audioFile.value) fd.append('audioFile', audioFile.value)
    if (coverImage.value) fd.append('coverImage', coverImage.value)
    if (selectedAlbumImage.value) fd.append('coverAlbumImageId', selectedAlbumImage.value.id)
    if (removeExistingCover.value) fd.append('removeCoverImage', 'true')

    if (!isEdit.value && !audioFile.value) {
      error.value = 'File audio obbligatorio'
      saving.value = false
      return
    }

    const config = {
      onUploadProgress: (e: any) => {
        if (e.total) uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      },
    }

    if (isEdit.value) {
      await axios.put(`/api/admin/audio/${route.params.id}`, fd, config)
    } else {
      await axios.post('/api/admin/audio', fd, config)
    }

    router.push('/audio')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore nel salvataggio'
  } finally {
    saving.value = false
    uploadProgress.value = 0
  }
}

// --- Load ---
onMounted(async () => {
  const [{ data: categoriesData }, { data: tagsData }] = await Promise.all([
    axios.get('/api/admin/categories'),
    axios.get('/api/admin/tags'),
  ])
  categories.value = categoriesData
  tags.value = tagsData

  if (isEdit.value) {
    loading.value = true
    try {
      const { data: audio } = await axios.get(`/api/admin/audio/${route.params.id}`)
      form.value = {
        title: audio.title,
        description: audio.description,
        categoryId: audio.categoryId,
        level: audio.level,
        status: audio.status,
        tagIds: (audio.tags || []).map((tag: any) => tag.id),
      }
      existingAudio.value = {
        url: null,
        originalName: audio.audioFileOriginalName,
        displayName: audio.audioFileDisplayName,
      }
      audioDisplayName.value = audio.audioFileDisplayName
      existingAlbumCover.value = audio.coverAlbumImage || null
      existingCover.value = audio.coverAlbumImage
        ? null
        : audio.coverImage
          ? {
              url: audio.coverImage,
              originalName: audio.coverImageOriginalName || '',
              displayName: audio.coverImageDisplayName || '',
            }
          : null
      selectedAlbumImage.value = null
      coverImageDisplayName.value = audio.coverAlbumImage ? '' : (audio.coverImageDisplayName || '')
      removeExistingCover.value = false
    } finally {
      loading.value = false
    }
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-2xl">
    <PageHeader
      :title="isEdit ? 'Modifica audio' : 'Nuovo audio'"
      :description="isEdit ? 'Aggiorna metadata, file e stato del contenuto audio.' : 'Configura metadata, asset e pubblicazione del nuovo contenuto audio.'"
    >
      <template #actions>
        <button type="button" @click="router.push('/audio')" class="btn-secondary">Annulla</button>
      </template>
    </PageHeader>

    <form @submit.prevent="save" class="card w-full space-y-5">
      <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{{ error }}</div>

      <div>
        <label class="label">Titolo *</label>
        <input v-model="form.title" type="text" required class="input-field" />
      </div>

      <div>
        <label class="label">Descrizione</label>
        <textarea v-model="form.description" rows="4" class="input-field"></textarea>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Categoria *</label>
          <select v-model="form.categoryId" required class="input-field">
            <option value="" disabled>Seleziona categoria</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">Livello</label>
          <select v-model="form.level" class="input-field">
            <option v-for="option in audioLevelOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
      </div>

      <div>
        <label class="label">Tag</label>
        <TagSelector v-model="form.tagIds" :tags="tags" />
      </div>

      <!-- Audio upload -->
      <div>
        <label class="label">File audio {{ isEdit ? '' : '*' }}</label>
        <p class="mb-2 text-xs text-text-secondary">
          Al salvataggio il file viene convertito in streaming HLS protetto. Serve `ffmpeg` disponibile nel runtime backend.
        </p>

        <!-- File selezionato -->
        <div v-if="audioFile" class="border border-green-200 bg-green-50 rounded-lg p-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text-primary truncate">{{ audioDisplayName || audioFile.name }}</p>
              <p class="text-xs text-text-secondary">{{ fileExtension(audioFile.name) }} &middot; {{ formatFileSize(audioFile.size) }}</p>
            </div>
            <button type="button" @click="removeAudio" class="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Rimuovi">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- File esistente (edit) -->
        <div v-else-if="existingAudio" class="border border-gray-200 bg-gray-50 rounded-lg p-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text-primary truncate">{{ existingAudio.displayName }}</p>
              <p class="text-xs text-text-secondary">File attuale</p>
            </div>
            <button type="button" @click="audioInputRef?.click()" class="text-xs text-primary hover:underline font-medium">Sostituisci</button>
          </div>
        </div>

        <!-- Dropzone -->
        <div
          v-else
          @click="audioInputRef?.click()"
          @dragover.prevent="audioDragging = true"
          @dragleave.prevent="audioDragging = false"
          @drop.prevent="handleAudioDrop"
          :class="[
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            audioDragging ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50'
          ]"
        >
          <svg class="w-8 h-8 mx-auto text-text-secondary/50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
          </svg>
          <p class="text-sm text-text-secondary">
            <span class="text-primary font-medium">Scegli un file</span> o trascinalo qui
          </p>
          <p class="text-xs text-text-secondary/70 mt-1">MP3, OGG, WAV &middot; max 100 MB</p>
        </div>

        <input ref="audioInputRef" type="file" :accept="audioAccept" @change="handleAudioSelect" class="hidden" />

        <div v-if="audioFile || existingAudio" class="mt-3">
          <label class="label">Nome file visualizzato</label>
          <input v-model="audioDisplayName" type="text" class="input-field" />
          <p class="text-xs text-text-secondary mt-1">
            Originale: {{ audioFile?.name || existingAudio?.originalName }}. L'estensione viene mantenuta automaticamente.
          </p>
        </div>
      </div>

      <!-- Cover image upload -->
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
            <p class="mt-1 text-xs text-text-secondary">Usalo se la copertina deve restare dedicata solo a questo audio.</p>
          </div>

          <div
            v-if="coverPreview || (existingCover?.url && !coverImage && !effectiveAlbumCover && !removeExistingCover)"
            class="relative mt-4 overflow-hidden rounded-lg border border-gray-200"
          >
            <img :src="coverPreview || existingCover?.url || ''" class="h-48 w-full object-cover" />
            <div class="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-colors hover:bg-black/40">
              <button
                type="button"
                @click="coverInputRef?.click()"
                class="bg-white px-3 py-1.5 text-xs font-medium text-text-primary opacity-0 shadow transition-opacity hover:opacity-100"
              >
                Sostituisci
              </button>
              <button
                type="button"
                @click="removeCover"
                class="bg-white px-3 py-1.5 text-xs font-medium text-red-500 opacity-0 shadow transition-opacity hover:opacity-100"
              >
                Rimuovi
              </button>
            </div>
          </div>

          <div
            v-else
            @click="coverInputRef?.click()"
            @dragover.prevent="coverDragging = true"
            @dragleave.prevent="coverDragging = false"
            @drop.prevent="handleCoverDrop"
            :class="[
              'mt-4 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
              coverDragging ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50'
            ]"
          >
            <svg class="mx-auto mb-2 h-8 w-8 text-text-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <p class="text-sm text-text-secondary">
              <span class="font-medium text-primary">Scegli un'immagine</span> o trascinala qui
            </p>
            <p class="mt-1 text-xs text-text-secondary/70">JPEG, PNG, WebP &middot; max 5 MB</p>
          </div>

          <input ref="coverInputRef" type="file" :accept="imageAccept" @change="handleCoverSelect" class="hidden" />

          <div v-if="(coverImage || existingCover) && !effectiveAlbumCover && !removeExistingCover" class="mt-3">
            <label class="label">Nome file visualizzato</label>
            <input v-model="coverImageDisplayName" type="text" class="input-field" />
            <p class="text-xs text-text-secondary mt-1">
              Originale: {{ coverImage?.name || existingCover?.originalName }}. L'estensione viene mantenuta automaticamente.
            </p>
          </div>

          <div v-else-if="effectiveAlbumCover" class="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            La copertina viene letta dall’album condiviso.
          </div>

          <div v-else-if="removeExistingCover" class="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            La copertina verrà rimossa al salvataggio.
          </div>
        </div>
      </div>

      <div>
        <label class="label">Stato</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" v-model="form.status" value="DRAFT" class="text-primary" />
            <span class="text-sm">Bozza</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" v-model="form.status" value="PUBLISHED" class="text-primary" />
            <span class="text-sm">Pubblicata</span>
          </label>
        </div>
      </div>

      <!-- Upload progress + submit -->
      <div class="space-y-3 pt-2">
        <!-- Progress bar -->
        <div v-if="saving && uploadProgress > 0 && uploadProgress < 100" class="space-y-1">
          <div class="flex items-center justify-between text-xs text-text-secondary">
            <span>Upload in corso...</span>
            <span class="font-medium tabular-nums">{{ uploadProgress }}%</span>
          </div>
          <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              :style="{ width: `${uploadProgress}%` }"
            ></div>
          </div>
        </div>

        <div class="flex gap-3">
          <button type="submit" :disabled="saving" class="btn-primary inline-flex items-center gap-2">
            <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ saving ? (uploadProgress > 0 && uploadProgress < 100 ? `Upload ${uploadProgress}%` : 'Salvataggio...') : 'Salva' }}
          </button>
          <button type="button" @click="router.push('/audio')" class="btn-secondary" :disabled="saving">Annulla</button>
        </div>
      </div>
    </form>
  </div>
</template>
