<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'

export type UploadFileItem = {
  id: string
  file: File
  previewUrl: string | null
  displayName: string
  error: string
}

export type ExistingFileMeta = {
  url: string | null
  originalName: string
  displayName: string
}

const props = withDefaults(
  defineProps<{
    modelValue: UploadFileItem[]
    accept: string
    acceptLabel: string
    maxSizeMb: number
    maxFiles?: number
    icon?: 'image' | 'audio' | 'file'
    showDisplayName?: boolean
    existingFile?: ExistingFileMeta | null
    progress?: number
    uploading?: boolean
    disabled?: boolean
  }>(),
  {
    maxFiles: 1,
    icon: 'file',
    showDisplayName: false,
    existingFile: null,
    progress: 0,
    uploading: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [items: UploadFileItem[]]
  'remove-existing': []
}>()

const dragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const isMulti = computed(() => props.maxFiles > 1)
const hasNewFiles = computed(() => props.modelValue.length > 0)
const showExisting = computed(() => !hasNewFiles.value && !!props.existingFile)
const showDropzone = computed(() => {
  if (props.disabled || props.uploading) return false
  if (!isMulti.value && hasNewFiles.value) return false
  if (!isMulti.value && showExisting.value) return false
  if (props.modelValue.length >= props.maxFiles) return false
  return true
})

let idCounter = 0
function generateId(): string {
  return `upload-${Date.now()}-${++idCounter}`
}

function validateFile(file: File): string {
  const acceptedTypes = props.accept.split(',').map((t) => t.trim())
  if (!acceptedTypes.includes(file.type)) {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const acceptedExts = acceptedTypes.map((t) => {
      const parts = t.split('/')
      return parts[1] || parts[0]
    })
    if (!acceptedExts.includes(ext)) {
      return `Formato non supportato. Usa ${props.acceptLabel}.`
    }
  }
  if (file.size > props.maxSizeMb * 1024 * 1024) {
    return `File troppo grande (max ${props.maxSizeMb} MB).`
  }
  return ''
}

function createUploadItem(file: File): UploadFileItem {
  const isImage = file.type.startsWith('image/')
  return {
    id: generateId(),
    file,
    previewUrl: isImage ? URL.createObjectURL(file) : null,
    displayName: file.name,
    error: validateFile(file),
  }
}

function addFiles(files: File[]) {
  if (props.disabled || props.uploading) return

  const remaining = props.maxFiles - props.modelValue.length
  if (remaining <= 0) return

  const toAdd = files.slice(0, remaining)
  const newItems = toAdd.map(createUploadItem)

  if (isMulti.value) {
    emit('update:modelValue', [...props.modelValue, ...newItems])
  } else {
    revokeAll()
    emit('update:modelValue', newItems.slice(0, 1))
  }
}

function removeFile(index: number) {
  if (props.disabled || props.uploading) return
  const item = props.modelValue[index]
  if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

function clearAll() {
  if (props.disabled || props.uploading) return
  revokeAll()
  emit('update:modelValue', [])
}

function updateDisplayName(index: number, name: string) {
  const updated = [...props.modelValue]
  updated[index] = { ...updated[index], displayName: name }
  emit('update:modelValue', updated)
}

function handleInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (files.length) addFiles(files)
  input.value = ''
}

function handleDrop(e: DragEvent) {
  dragging.value = false
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length) addFiles(files)
}

function handleDragEnter(e: DragEvent) {
  if (props.disabled || props.uploading) return
  dragging.value = true
}

function triggerInput() {
  if (props.disabled || props.uploading) return
  inputRef.value?.click()
}

function removeExisting() {
  emit('remove-existing')
}

function revokeAll() {
  props.modelValue.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExtension(name: string): string {
  return name.split('.').pop()?.toUpperCase() || ''
}

onBeforeUnmount(() => {
  revokeAll()
})
</script>

<template>
  <div class="space-y-3">
    <!-- ==================== NEW FILES ==================== -->
    <template v-if="hasNewFiles">
      <!-- Single image with preview -->
      <div
        v-if="!isMulti && modelValue[0].previewUrl && !modelValue[0].error"
        class="relative overflow-hidden rounded-lg border border-gray-200"
      >
        <img :src="modelValue[0].previewUrl" class="h-48 w-full object-cover" />
        <div
          class="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all hover:bg-black/40 hover:opacity-100"
        >
          <button
            type="button"
            @click="triggerInput"
            class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-text-primary shadow transition-colors hover:bg-gray-50"
          >
            Sostituisci
          </button>
          <button
            type="button"
            @click="removeFile(0)"
            class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-500 shadow transition-colors hover:bg-red-50"
          >
            Rimuovi
          </button>
        </div>
      </div>

      <!-- Single non-image file (audio, generic) or image with error -->
      <div
        v-else-if="!isMulti"
        class="rounded-lg border p-3"
        :class="modelValue[0].error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
            :class="modelValue[0].error ? 'bg-red-100' : 'bg-green-100'"
          >
            <!-- Audio icon -->
            <svg
              v-if="icon === 'audio'"
              class="h-5 w-5"
              :class="modelValue[0].error ? 'text-red-600' : 'text-green-600'"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <!-- Image icon -->
            <svg
              v-else-if="icon === 'image'"
              class="h-5 w-5"
              :class="modelValue[0].error ? 'text-red-600' : 'text-green-600'"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <!-- Generic file icon -->
            <svg
              v-else
              class="h-5 w-5"
              :class="modelValue[0].error ? 'text-red-600' : 'text-green-600'"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-text-primary">
              {{ modelValue[0].displayName || modelValue[0].file.name }}
            </p>
            <p class="text-xs text-text-secondary">
              {{ fileExtension(modelValue[0].file.name) }} &middot;
              {{ formatFileSize(modelValue[0].file.size) }}
            </p>
            <p v-if="modelValue[0].error" class="mt-1 text-xs text-red-600">
              {{ modelValue[0].error }}
            </p>
          </div>

          <button
            v-if="!uploading"
            type="button"
            @click="removeFile(0)"
            class="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-red-50 hover:text-red-500"
            title="Rimuovi"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Multiple files list -->
      <div v-else class="space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-text-primary">
            {{ modelValue.length }} file selezionat{{ modelValue.length === 1 ? 'o' : 'i' }}
          </p>
          <button
            v-if="!uploading"
            type="button"
            class="text-sm font-medium text-red-500 hover:underline"
            @click="clearAll"
          >
            Svuota lista
          </button>
        </div>

        <div class="space-y-2">
          <div
            v-for="(item, index) in modelValue"
            :key="item.id"
            class="flex items-center gap-3 rounded-2xl border px-3 py-3"
            :class="
              item.error
                ? 'border-red-100 bg-red-50'
                : 'border-gray-100 bg-white'
            "
          >
            <img
              v-if="item.previewUrl"
              :src="item.previewUrl"
              :alt="item.file.name"
              class="h-14 w-14 rounded-xl object-cover"
            />
            <div
              v-else
              class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100"
            >
              <svg
                v-if="icon === 'audio'"
                class="h-6 w-6 text-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <svg
                v-else
                class="h-6 w-6 text-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-text-primary">{{ item.file.name }}</p>
              <p class="mt-1 text-xs text-text-secondary">{{ formatFileSize(item.file.size) }}</p>
              <p v-if="item.error" class="mt-1 text-xs text-red-600">{{ item.error }}</p>
            </div>

            <button
              v-if="!uploading"
              type="button"
              class="icon-action-button icon-action-button-danger"
              @click="removeFile(index)"
            >
              <svg
                class="h-4 w-4 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Display name (single mode) -->
      <div v-if="showDisplayName && !isMulti && modelValue.length === 1 && !modelValue[0].error">
        <label class="label">Nome file visualizzato</label>
        <input
          :value="modelValue[0].displayName"
          @input="updateDisplayName(0, ($event.target as HTMLInputElement).value)"
          type="text"
          class="input-field"
        />
        <p class="mt-1 text-xs text-text-secondary">
          Originale: {{ modelValue[0].file.name }}. L'estensione viene mantenuta automaticamente.
        </p>
      </div>
    </template>

    <!-- ==================== EXISTING FILE ==================== -->
    <template v-else-if="showExisting">
      <!-- Existing image with preview -->
      <div
        v-if="icon === 'image' && existingFile?.url"
        class="relative overflow-hidden rounded-lg border border-gray-200"
      >
        <img :src="existingFile.url" class="h-48 w-full object-cover" />
        <div
          class="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all hover:bg-black/40 hover:opacity-100"
        >
          <button
            type="button"
            @click="triggerInput"
            class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-text-primary shadow transition-colors hover:bg-gray-50"
          >
            Sostituisci
          </button>
          <button
            type="button"
            @click="removeExisting"
            class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-500 shadow transition-colors hover:bg-red-50"
          >
            Rimuovi
          </button>
        </div>
      </div>

      <!-- Existing non-image file -->
      <div v-else class="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100"
          >
            <svg
              v-if="icon === 'audio'"
              class="h-5 w-5 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <svg
              v-else
              class="h-5 w-5 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-text-primary">
              {{ existingFile!.displayName }}
            </p>
            <p class="text-xs text-text-secondary">File attuale</p>
          </div>

          <button
            type="button"
            @click="triggerInput"
            class="text-xs font-medium text-primary hover:underline"
          >
            Sostituisci
          </button>
        </div>
      </div>
    </template>

    <!-- ==================== DROPZONE ==================== -->
    <div
      v-if="showDropzone"
      @click="triggerInput"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent
      @dragleave.prevent="dragging = false"
      @drop.prevent="handleDrop"
      :class="[
        'cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50',
      ]"
    >
      <!-- Audio icon -->
      <svg
        v-if="icon === 'audio'"
        class="mx-auto mb-2 h-8 w-8 text-text-secondary/50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
      <!-- Image icon -->
      <svg
        v-else-if="icon === 'image'"
        class="mx-auto mb-2 h-8 w-8 text-text-secondary/50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <!-- Generic file icon -->
      <svg
        v-else
        class="mx-auto mb-2 h-8 w-8 text-text-secondary/50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>

      <p class="text-sm text-text-secondary">
        <span class="font-medium text-primary">{{
          isMulti ? 'Seleziona file' : 'Scegli un file'
        }}</span>
        {{ isMulti ? ' oppure trascinali qui' : ' o trascinalo qui' }}
      </p>
      <p class="mt-1 text-xs text-text-secondary/70">
        {{ acceptLabel }} &middot; max {{ maxSizeMb }} MB
      </p>
    </div>

    <!-- ==================== ADD MORE (multi mode) ==================== -->
    <div
      v-if="isMulti && hasNewFiles && modelValue.length < maxFiles && !uploading"
      @click="triggerInput"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent
      @dragleave.prevent="dragging = false"
      @drop.prevent="handleDrop"
      :class="[
        'cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors',
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50',
      ]"
    >
      <p class="text-sm text-text-secondary">
        <span class="font-medium text-primary">Aggiungi altri file</span>
        ({{ modelValue.length }}/{{ maxFiles }})
      </p>
    </div>

    <!-- ==================== HIDDEN INPUT ==================== -->
    <input
      ref="inputRef"
      type="file"
      :accept="accept"
      :multiple="isMulti"
      class="hidden"
      @change="handleInputChange"
    />

    <!-- ==================== PROGRESS BAR ==================== -->
    <div v-if="progress > 0 && progress < 100" class="space-y-1">
      <div class="flex items-center justify-between text-xs text-text-secondary">
        <span>Upload in corso...</span>
        <span class="font-medium tabular-nums">{{ progress }}%</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          class="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </div>
  </div>
</template>
