<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import TiptapEditor from '../components/TiptapEditor.vue'
import TagSelector, { type SelectableTag } from '../components/TagSelector.vue'
import AlbumImagePicker from '../components/AlbumImagePicker.vue'
import FileUploader, { type UploadFileItem, type ExistingFileMeta } from '../components/FileUploader.vue'
import type { AlbumImage } from '../types/album'
import { getPublicAppUrl } from '../utils/appUrls'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const saving = ref(false)
const uploadProgress = ref(0)
const error = ref('')
const tags = ref<SelectableTag[]>([])

const form = ref({
  title: '',
  author: '',
  excerpt: '',
  body: '',
  status: 'DRAFT',
  visibility: 'REGISTERED',
  tagIds: [] as string[],
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
    fd.append('author', form.value.author)
    fd.append('excerpt', form.value.excerpt)
    fd.append('body', form.value.body)
    fd.append('status', form.value.status)
    fd.append('visibility', form.value.visibility)
    fd.append('publicBaseUrl', getPublicAppUrl())
    fd.append('tagIds', JSON.stringify(form.value.tagIds))
    fd.append('coverImageDisplayName', coverFiles.value.length ? coverFiles.value[0].displayName : coverImageDisplayName.value)

    if (coverFiles.value.length) fd.append('coverImage', coverFiles.value[0].file)
    if (selectedAlbumImage.value) fd.append('coverAlbumImageId', selectedAlbumImage.value.id)
    if (removeExistingCover.value) fd.append('removeCoverImage', 'true')

    const config = {
      onUploadProgress: (e: any) => {
        if (e.total) uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      },
    }

    if (isEdit.value) {
      await axios.put(`/api/admin/thoughts/${route.params.id}`, fd, config)
    } else {
      await axios.post('/api/admin/thoughts', fd, config)
    }

    router.push('/thoughts')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore nel salvataggio'
  } finally {
    saving.value = false
    uploadProgress.value = 0
  }
}

onMounted(async () => {
  const { data: tagsData } = await axios.get('/api/admin/tags')
  tags.value = tagsData

  if (isEdit.value) {
    loading.value = true
    try {
      const { data: article } = await axios.get(`/api/admin/thoughts/${route.params.id}`)
      form.value = {
        title: article.title,
        author: article.author,
        excerpt: article.excerpt || '',
        body: article.body,
        status: article.status,
        visibility: article.visibility,
        tagIds: (article.tags || []).map((tag: any) => tag.id),
      }
      existingAlbumCover.value = article.coverAlbumImage || null
      existingCover.value = article.coverAlbumImage
        ? null
        : article.coverImage
          ? {
              url: article.coverImage,
              originalName: article.coverImageOriginalName || '',
              displayName: article.coverImageDisplayName || '',
            }
          : null
      selectedAlbumImage.value = null
      coverImageDisplayName.value = article.coverAlbumImage ? '' : (article.coverImageDisplayName || '')
      removeExistingCover.value = false
    } finally {
      loading.value = false
    }
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl">
    <PageHeader
      :title="isEdit ? 'Modifica pensiero' : 'Nuovo pensiero'"
      :description="isEdit ? 'Aggiorna contenuto, metadata e stato editoriale.' : 'Crea un nuovo pensiero con contenuto, autore e metadata.'"
    >
      <template #actions>
        <button type="button" @click="router.push('/thoughts')" class="btn-secondary">Annulla</button>
      </template>
    </PageHeader>

    <form @submit.prevent="save" class="card w-full space-y-5">
      <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{{ error }}</div>

      <div>
        <label class="label">Titolo *</label>
        <input v-model="form.title" type="text" required class="input-field" />
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label class="label">Autore *</label>
          <input v-model="form.author" type="text" required class="input-field" />
        </div>
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
        <label class="label">Tag</label>
        <TagSelector v-model="form.tagIds" :tags="tags" />
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
          <button type="button" @click="router.push('/thoughts')" class="btn-secondary" :disabled="saving">Annulla</button>
        </div>
      </div>
    </form>
  </div>
</template>
