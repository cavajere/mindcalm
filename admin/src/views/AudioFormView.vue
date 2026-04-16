<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import TagSelector, { type SelectableTag } from '../components/TagSelector.vue'
import AlbumImagePicker from '../components/AlbumImagePicker.vue'
import FileUploader, { type UploadFileItem, type ExistingFileMeta } from '../components/FileUploader.vue'
import type { AlbumImage } from '../types/album'
import { audioLevelOptions } from '../utils/audioLevels'
import { getPublicAppUrl } from '../utils/appUrls'
import { useToast } from '../composables/useToast'
import { getApiErrorMessage } from '../utils/apiMessages'

const route = useRoute()
const router = useRouter()

const toast = useToast()
const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const saving = ref(false)
const uploadProgress = ref(0)
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
const audioFiles = ref<UploadFileItem[]>([])
const existingAudio = ref<ExistingFileMeta | null>(null)
const audioDisplayName = ref('')

function handleAudioFilesUpdate(files: UploadFileItem[]) {
  audioFiles.value = files
  if (files.length) {
    audioDisplayName.value = files[0].displayName
  } else if (existingAudio.value) {
    audioDisplayName.value = existingAudio.value.displayName
  } else {
    audioDisplayName.value = ''
  }
}

// --- Cover image ---
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

// --- Save ---
async function save() {
  saving.value = true
  uploadProgress.value = 0

  try {
    const fd = new FormData()
    fd.append('title', form.value.title)
    fd.append('description', form.value.description)
    fd.append('categoryId', form.value.categoryId)
    fd.append('level', form.value.level)
    fd.append('status', form.value.status)
    fd.append('publicBaseUrl', getPublicAppUrl())
    fd.append('tagIds', JSON.stringify(form.value.tagIds))
    fd.append('audioFileDisplayName', audioFiles.value.length ? audioFiles.value[0].displayName : audioDisplayName.value)
    fd.append('coverImageDisplayName', coverFiles.value.length ? coverFiles.value[0].displayName : coverImageDisplayName.value)

    if (audioFiles.value.length) fd.append('audioFile', audioFiles.value[0].file)
    if (coverFiles.value.length) fd.append('coverImage', coverFiles.value[0].file)
    if (selectedAlbumImage.value) fd.append('coverAlbumImageId', selectedAlbumImage.value.id)
    if (removeExistingCover.value) fd.append('removeCoverImage', 'true')

    if (!isEdit.value && !audioFiles.value.length) {
      toast.warning('File audio obbligatorio')
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

    toast.success(isEdit.value ? 'Audio aggiornato' : 'Audio creato')
    router.push('/audio')
  } catch (e: unknown) {
    toast.error(getApiErrorMessage(e, 'Errore nel salvataggio'))
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

        <FileUploader
          :model-value="audioFiles"
          @update:model-value="handleAudioFilesUpdate"
          accept="audio/mpeg,audio/ogg,audio/wav"
          accept-label="MP3, OGG, WAV"
          :max-size-mb="100"
          icon="audio"
          show-display-name
          :existing-file="existingAudio"
          :progress="uploadProgress"
          :uploading="saving"
        />

        <!-- Display name for existing audio (when no new file selected) -->
        <div v-if="!audioFiles.length && existingAudio" class="mt-3">
          <label class="label">Nome file visualizzato</label>
          <input v-model="audioDisplayName" type="text" class="input-field" />
          <p class="text-xs text-text-secondary mt-1">
            Originale: {{ existingAudio.originalName }}. L'estensione viene mantenuta automaticamente.
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
