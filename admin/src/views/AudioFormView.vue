<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import TagSelector, { type SelectableTag } from '../components/TagSelector.vue'
import { audioLevelOptions } from '../utils/audioLevels'

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
const existingAudio = ref('')
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
}

function removeAudio() {
  audioFile.value = null
  if (audioInputRef.value) audioInputRef.value.value = ''
}

// --- Cover image ---
const coverImage = ref<File | null>(null)
const existingCover = ref('')
const coverPreview = ref('')
const coverDragging = ref(false)
const coverInputRef = ref<HTMLInputElement | null>(null)

const imageAccept = 'image/jpeg,image/png,image/webp'

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
}

function removeCover() {
  coverImage.value = null
  coverPreview.value = ''
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

    if (audioFile.value) fd.append('audioFile', audioFile.value)
    if (coverImage.value) fd.append('coverImage', coverImage.value)

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
      const { data: audioData } = await axios.get('/api/admin/audio?limit=100')
      const audio = audioData.data.find((item: any) => item.id === route.params.id)
      if (audio) {
        form.value = {
          title: audio.title,
          description: audio.description,
          categoryId: audio.categoryId,
          level: audio.level,
          status: audio.status,
          tagIds: (audio.tags || []).map((tag: any) => tag.id),
        }
        existingAudio.value = audio.audioFile
        existingCover.value = audio.coverImage || ''
      }
    } finally {
      loading.value = false
    }
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-2xl">
    <div class="flex items-center gap-4 mb-6">
      <button @click="router.push('/audio')" class="text-text-secondary hover:text-text-primary">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="text-2xl font-bold text-text-primary">{{ isEdit ? 'Modifica audio' : 'Nuovo audio' }}</h1>
    </div>

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
              <p class="text-sm font-medium text-text-primary truncate">{{ audioFile.name }}</p>
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
              <p class="text-sm font-medium text-text-primary truncate">{{ existingAudio.split('/').pop() }}</p>
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
      </div>

      <!-- Cover image upload -->
      <div>
        <label class="label">Immagine copertina</label>

        <!-- Preview immagine selezionata -->
        <div v-if="coverPreview || (existingCover && !coverImage)" class="relative rounded-lg overflow-hidden border border-gray-200">
          <img :src="coverPreview || existingCover" class="w-full h-48 object-cover" />
          <div class="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors group flex items-center justify-center gap-2">
            <button
              type="button"
              @click="coverInputRef?.click()"
              class="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-text-primary text-xs font-medium px-3 py-1.5 rounded-lg shadow"
            >
              Sostituisci
            </button>
            <button
              type="button"
              @click="removeCover"
              class="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-red-500 text-xs font-medium px-3 py-1.5 rounded-lg shadow"
            >
              Rimuovi
            </button>
          </div>
        </div>

        <!-- Dropzone -->
        <div
          v-else
          @click="coverInputRef?.click()"
          @dragover.prevent="coverDragging = true"
          @dragleave.prevent="coverDragging = false"
          @drop.prevent="handleCoverDrop"
          :class="[
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            coverDragging ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50'
          ]"
        >
          <svg class="w-8 h-8 mx-auto text-text-secondary/50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <p class="text-sm text-text-secondary">
            <span class="text-primary font-medium">Scegli un'immagine</span> o trascinala qui
          </p>
          <p class="text-xs text-text-secondary/70 mt-1">JPEG, PNG, WebP &middot; max 5 MB</p>
        </div>

        <input ref="coverInputRef" type="file" :accept="imageAccept" @change="handleCoverSelect" class="hidden" />
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
