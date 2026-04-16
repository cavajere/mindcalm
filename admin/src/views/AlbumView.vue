<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import AdminModal from '../components/AdminModal.vue'
import PageHeader from '../components/PageHeader.vue'
import { useConfirm } from '../composables/useConfirm'
import type { AlbumImage } from '../types/album'

type PendingFile = {
  file: File
  previewUrl: string
  error: string
  status?: 'created' | 'duplicate'
  existingFilename?: string | null
}

const loading = ref(true)
const saving = ref(false)
const images = ref<AlbumImage[]>([])

const searchQuery = ref('')
const usageFilter = ref<'all' | 'inUse' | 'unused'>('all')
const viewMode = ref<'large' | 'small'>('large')
const visibleCount = ref(24)

const createDialogOpen = ref(false)
const { confirm } = useConfirm()
const isDragOver = ref(false)
const createFileInputRef = ref<HTMLInputElement | null>(null)
const pendingFiles = ref<PendingFile[]>([])
const createFileError = ref('')
const uploadDone = ref(false)

const editDialogOpen = ref(false)
const editingImageId = ref<string | null>(null)
const editForm = reactive({
  title: '',
  description: '',
})

const MAX_FILES = 30
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

const filteredImages = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return images.value.filter((image) => {
    if (usageFilter.value === 'inUse' && !image.inUse) return false
    if (usageFilter.value === 'unused' && image.inUse) return false
    if (!query) return true

    return [
      image.title,
      image.description,
      image.displayName,
      image.originalName,
    ].some((value) => value?.toLowerCase().includes(query))
  })
})

const visibleImages = computed(() => filteredImages.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleImages.value.length < filteredImages.value.length)

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toUpperCase() || 'FILE'
}

function revokePendingPreviews() {
  pendingFiles.value.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })
}

function resetCreateDialog() {
  revokePendingPreviews()
  pendingFiles.value = []
  createFileError.value = ''
  uploadDone.value = false
  isDragOver.value = false
  if (createFileInputRef.value) createFileInputRef.value.value = ''
}

function openCreateDialog() {
  createDialogOpen.value = true
  resetCreateDialog()
}

function closeCreateDialog() {
  createDialogOpen.value = false
  resetCreateDialog()
}

function triggerFileInput() {
  createFileInputRef.value?.click()
}

function validateImage(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Formato non supportato. Usa JPEG, PNG o WebP.'
  }

  if (file.size > MAX_SIZE_BYTES) {
    return 'File troppo grande. Max 5 MB.'
  }

  return ''
}

function appendPendingFiles(newFiles: File[]) {
  createFileError.value = ''
  const remaining = MAX_FILES - pendingFiles.value.length

  if (remaining <= 0) {
    createFileError.value = `Puoi caricare al massimo ${MAX_FILES} immagini per volta.`
    return
  }

  const acceptedFiles = newFiles.slice(0, remaining)
  const skippedFiles = newFiles.length - acceptedFiles.length

  pendingFiles.value.push(
    ...acceptedFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      error: validateImage(file),
    })),
  )

  if (skippedFiles > 0) {
    createFileError.value = `Alcuni file sono stati ignorati: limite massimo ${MAX_FILES}.`
  }
}

function handleFileInput(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files || [])
  if (files.length) appendPendingFiles(files)
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  if (files.length) appendPendingFiles(files)
}

function removePendingFile(index: number) {
  const target = pendingFiles.value[index]
  if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
  pendingFiles.value.splice(index, 1)
}

function clearAllFiles() {
  resetCreateDialog()
}

function loadMore() {
  visibleCount.value += 24
}

function openEditDialog(image: AlbumImage) {
  editingImageId.value = image.id
  editForm.title = image.title || ''
  editForm.description = image.description || ''
  editDialogOpen.value = true
}

async function fetchImages() {
  loading.value = true

  try {
    const { data } = await axios.get('/api/admin/album')
    images.value = Array.isArray(data) ? data : []
    visibleCount.value = 24
  } finally {
    loading.value = false
  }
}

async function uploadImages() {
  const validFiles = pendingFiles.value.filter((item) => !item.error)
  if (!validFiles.length) {
    createFileError.value = 'Seleziona almeno un file valido.'
    return
  }

  saving.value = true
  createFileError.value = ''

  try {
    const payload = new FormData()
    validFiles.forEach((item) => payload.append('images', item.file))

    const { data } = await axios.post('/api/admin/album/bulk', payload)
    const results = Array.isArray(data) ? data : []
    const byFilename = new Map(results.map((result: any) => [result.filename, result]))

    pendingFiles.value = pendingFiles.value.map((item) => {
      const result = byFilename.get(item.file.name)
      if (!result) return item

      return {
        ...item,
        status: result.status,
        existingFilename: result.existingFilename || null,
      }
    })

    uploadDone.value = true
    await fetchImages()
  } catch (err: any) {
    createFileError.value = err.response?.data?.error || 'Upload non riuscito'
  } finally {
    saving.value = false
  }
}

async function saveMetadata() {
  if (!editingImageId.value) return

  saving.value = true
  try {
    await axios.put(`/api/admin/album/${editingImageId.value}`, {
      title: editForm.title,
      description: editForm.description,
    })
    editDialogOpen.value = false
    await fetchImages()
  } finally {
    saving.value = false
  }
}

function downloadImage(image: AlbumImage) {
  if (!image.url) return

  const link = document.createElement('a')
  link.href = image.url
  link.download = image.displayName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function removeImage(image: AlbumImage) {
  if (image.inUse) {
    const details = image.dependencies.map((item) => `• ${item.label}`).join('\n')
    window.alert(`Immagine in uso.\n\n${details}`)
    return
  }

  if (!await confirm({ message: `Eliminare "${image.title || image.displayName}" dall'album?`, variant: 'danger', confirmLabel: 'Elimina' })) {
    return
  }

  await axios.delete(`/api/admin/album/${image.id}`)
  await fetchImages()
}

onMounted(fetchImages)

onBeforeUnmount(() => {
  revokePendingPreviews()
})
</script>

<template>
  <div>
    <PageHeader
      title="Album"
      description="Carica foto riutilizzabili, aggiorna i metadati e controlla dove ogni immagine è già stata pubblicata."
    >
      <template #actions>
        <button type="button" class="btn-primary" @click="openCreateDialog">+ Aggiungi foto</button>
      </template>
    </PageHeader>

    <div class="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
      <input
        v-model="searchQuery"
        type="text"
        class="input-field"
        placeholder="Cerca per titolo, descrizione o nome file"
      />

      <select v-model="usageFilter" class="input-field">
        <option value="all">Tutte</option>
        <option value="inUse">In uso</option>
        <option value="unused">Non utilizzate</option>
      </select>

      <div class="inline-flex rounded-xl border border-gray-200 bg-white p-1">
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="viewMode === 'large' ? 'bg-slate-950 text-white' : 'text-text-secondary'"
          @click="viewMode = 'large'"
        >
          Large
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="viewMode === 'small' ? 'bg-slate-950 text-white' : 'text-text-secondary'"
          @click="viewMode = 'small'"
        >
          Small
        </button>
      </div>
    </div>

    <div v-if="loading" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div v-for="n in 6" :key="n" class="h-72 animate-pulse rounded-3xl bg-gray-100" />
    </div>

    <div v-else-if="!images.length" class="rounded-3xl border border-gray-100 bg-white px-6 py-14 text-center">
      <p class="text-lg font-semibold text-text-primary">Album vuoto</p>
      <p class="mt-2 text-sm text-text-secondary">Carica le prime immagini per riutilizzarle su audio e post.</p>
      <button type="button" class="btn-primary mt-5" @click="openCreateDialog">Carica immagini</button>
    </div>

    <div v-else-if="!filteredImages.length" class="rounded-3xl border border-gray-100 bg-white px-6 py-14 text-center">
      <p class="text-lg font-semibold text-text-primary">Nessun risultato</p>
      <p class="mt-2 text-sm text-text-secondary">Prova a cambiare ricerca o filtro utilizzo.</p>
    </div>

    <div
      v-else
      class="grid gap-5"
      :class="viewMode === 'small' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-3'"
    >
      <article
        v-for="image in visibleImages"
        :key="image.id"
        class="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div class="relative">
          <img v-if="image.url" :src="image.url" :alt="image.title || image.displayName" class="w-full object-cover" :class="viewMode === 'small' ? 'h-40' : 'h-52'" />
          <div class="absolute right-3 top-3 inline-flex items-center rounded-full bg-slate-950/75 px-2.5 py-1 text-xs font-medium text-white">
            {{ image.dependencyCount }}
          </div>
        </div>

        <div class="space-y-4 p-4">
          <div>
            <p class="truncate text-sm font-semibold text-text-primary">{{ image.title || image.displayName }}</p>
            <p class="mt-1 truncate text-xs text-text-secondary">{{ image.displayName }}</p>
            <p v-if="viewMode === 'large' && image.description" class="mt-2 text-sm leading-6 text-text-secondary">
              {{ image.description }}
            </p>
          </div>

          <div v-if="viewMode === 'large' && image.dependencies.length" class="rounded-2xl bg-gray-50 px-3 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Utilizzi</p>
            <ul class="mt-2 space-y-1 text-sm text-text-secondary">
              <li v-for="dependency in image.dependencies.slice(0, 3)" :key="`${image.id}-${dependency.type}-${dependency.entityId}`">
                {{ dependency.label }}
              </li>
            </ul>
            <p v-if="image.dependencies.length > 3" class="mt-2 text-xs text-text-secondary">
              +{{ image.dependencies.length - 3 }} altri utilizzi
            </p>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-text-secondary">{{ getExtension(image.displayName) }}</span>
              <span class="text-xs text-text-secondary">{{ formatFileSize(image.size) }}</span>
            </div>

            <div class="flex items-center gap-1">
              <button type="button" class="icon-action-button icon-action-button-neutral" title="Scarica" @click="downloadImage(image)">
                <svg class="h-4 w-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3v12m0 0l4-4m-4 4l-4-4m-5 8h18" />
                </svg>
              </button>
              <button type="button" class="icon-action-button icon-action-button-neutral" title="Modifica" @click="openEditDialog(image)">
                <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.5-7.5l2 2L11 16H9v-2z" />
                </svg>
              </button>
              <button type="button" class="icon-action-button icon-action-button-danger" title="Elimina" @click="removeImage(image)">
                <svg class="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 7h12m-9 0V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12h8l1-12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div v-if="hasMore" class="mt-6 flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3">
      <p class="text-sm text-text-secondary">Mostrate {{ visibleImages.length }} immagini su {{ filteredImages.length }}</p>
      <button type="button" class="btn-secondary" @click="loadMore">Carica altre</button>
    </div>

    <AdminModal :open="createDialogOpen" panel-class="max-w-3xl" overlay-class="bg-slate-950/60 p-4" @close="closeCreateDialog">
      <div class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-gray-100 px-6 py-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-lg font-semibold text-text-primary">Carica foto</p>
              <p class="mt-1 text-sm text-text-secondary">Puoi caricare fino a 30 immagini in un unico batch.</p>
            </div>
            <button type="button" class="btn-secondary" @click="closeCreateDialog">Chiudi</button>
          </div>
        </div>

        <div class="overflow-y-auto px-6 py-6">
          <div
            class="rounded-[24px] border-2 border-dashed p-8 text-center transition-colors"
            :class="isDragOver ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50/60'"
            @dragenter.prevent="isDragOver = true"
            @dragover.prevent="isDragOver = true"
            @dragleave.prevent="isDragOver = false"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
          >
            <input
              ref="createFileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              class="hidden"
              @change="handleFileInput"
            />
            <svg class="mx-auto h-10 w-10 text-text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p class="mt-3 text-sm text-text-secondary">
              <span class="font-medium text-primary">Seleziona file</span> oppure trascinali qui
            </p>
            <p class="mt-1 text-xs text-text-secondary/70">JPEG, PNG, WebP · max 5 MB per immagine</p>
          </div>

          <div v-if="createFileError" class="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {{ createFileError }}
          </div>

          <div v-if="pendingFiles.length" class="mt-5 space-y-3">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-text-primary">{{ pendingFiles.length }} file selezionati</p>
              <button type="button" class="text-sm font-medium text-red-500 hover:underline" @click="clearAllFiles">Svuota lista</button>
            </div>

            <div class="space-y-3">
              <div
                v-for="(item, index) in pendingFiles"
                :key="`${item.file.name}-${index}`"
                class="flex items-center gap-3 rounded-2xl border px-3 py-3"
                :class="item.error ? 'border-red-100 bg-red-50' : item.status === 'created' ? 'border-green-100 bg-green-50' : item.status === 'duplicate' ? 'border-amber-100 bg-amber-50' : 'border-gray-100 bg-white'"
              >
                <img :src="item.previewUrl" :alt="item.file.name" class="h-14 w-14 rounded-xl object-cover" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-text-primary">{{ item.file.name }}</p>
                  <p class="mt-1 text-xs text-text-secondary">{{ formatFileSize(item.file.size) }}</p>
                  <p v-if="item.error" class="mt-1 text-xs text-red-600">{{ item.error }}</p>
                  <p v-else-if="item.status === 'created'" class="mt-1 text-xs text-green-700">Caricata correttamente</p>
                  <p v-else-if="item.status === 'duplicate'" class="mt-1 text-xs text-amber-700">
                    Duplicato{{ item.existingFilename ? ` di ${item.existingFilename}` : '' }}
                  </p>
                </div>
                <button
                  v-if="!saving && !item.status"
                  type="button"
                  class="icon-action-button icon-action-button-danger"
                  @click.stop="removePendingFile(index)"
                >
                  <svg class="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 7h12m-9 0V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12h8l1-12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="border-t border-gray-100 px-6 py-4">
          <div class="flex items-center justify-end gap-3">
            <button type="button" class="btn-secondary" @click="closeCreateDialog">Chiudi</button>
            <button type="button" class="btn-primary" :disabled="saving || !pendingFiles.length || uploadDone" @click="uploadImages">
              {{ saving ? 'Upload in corso...' : 'Carica immagini' }}
            </button>
          </div>
        </div>
      </div>
    </AdminModal>

    <AdminModal :open="editDialogOpen" panel-class="max-w-xl" overlay-class="bg-slate-950/60 p-4" @close="editDialogOpen = false">
      <div class="w-full rounded-[28px] bg-white p-6 shadow-2xl">
        <p class="text-lg font-semibold text-text-primary">Modifica metadati</p>
        <p class="mt-1 text-sm text-text-secondary">Aggiorna titolo e descrizione dell’immagine selezionata.</p>

        <div class="mt-5 space-y-4">
          <div>
            <label class="label">Titolo</label>
            <input v-model="editForm.title" type="text" maxlength="180" class="input-field" />
          </div>
          <div>
            <label class="label">Descrizione</label>
            <textarea v-model="editForm.description" rows="4" maxlength="1000" class="input-field"></textarea>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-end gap-3">
          <button type="button" class="btn-secondary" @click="editDialogOpen = false">Annulla</button>
          <button type="button" class="btn-primary" :disabled="saving" @click="saveMetadata">
            {{ saving ? 'Salvataggio...' : 'Salva' }}
          </button>
        </div>
      </div>
    </AdminModal>
  </div>
</template>
