<script setup lang="ts">
import { computed, ref } from 'vue'
import axios from 'axios'
import type { AlbumImage } from '../types/album'

const props = withDefaults(defineProps<{
  selectedImage: AlbumImage | null
  label?: string
}>(), {
  label: 'Immagine da album',
})

const emit = defineEmits<{
  select: [image: AlbumImage]
  clear: []
}>()

const open = ref(false)
const loading = ref(false)
const error = ref('')
const images = ref<AlbumImage[]>([])
const searchQuery = ref('')
const usageFilter = ref<'all' | 'inUse' | 'unused'>('all')
const viewMode = ref<'large' | 'small'>('large')

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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function openPicker() {
  open.value = true
  void fetchImages()
}

async function fetchImages() {
  loading.value = true
  error.value = ''

  try {
    const { data } = await axios.get('/api/admin/album')
    images.value = Array.isArray(data) ? data : []
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Impossibile caricare l’album'
  } finally {
    loading.value = false
  }
}

function selectImage(image: AlbumImage) {
  emit('select', image)
  open.value = false
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <label class="label mb-0">{{ label }}</label>
      <router-link to="/album" class="text-sm font-medium text-primary hover:underline">Apri album</router-link>
    </div>

    <div v-if="selectedImage" class="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
        <img
          v-if="selectedImage.url"
          :src="selectedImage.url"
          :alt="selectedImage.title || selectedImage.displayName"
          class="h-28 w-full rounded-xl object-cover sm:w-40"
        />
        <div class="min-w-0 flex-1 space-y-2">
          <div>
            <p class="text-sm font-semibold text-text-primary">
              {{ selectedImage.title || selectedImage.displayName }}
            </p>
            <p class="mt-1 text-xs text-text-secondary">
              {{ selectedImage.displayName }} · {{ formatFileSize(selectedImage.size) }}
            </p>
          </div>
          <p v-if="selectedImage.description" class="text-sm text-text-secondary">{{ selectedImage.description }}</p>
          <div class="flex flex-wrap gap-2">
            <span class="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
              Da album
            </span>
            <span
              v-if="selectedImage.dependencyCount > 0"
              class="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-text-secondary ring-1 ring-gray-200"
            >
              {{ selectedImage.dependencyCount }} utilizzi
            </span>
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="btn-secondary" @click="openPicker">Sostituisci da album</button>
        <button type="button" class="text-sm font-medium text-red-500 hover:underline" @click="emit('clear')">
          Rimuovi selezione album
        </button>
      </div>
    </div>

    <div
      v-else
      class="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-5 py-5 text-center"
    >
      <p class="text-sm text-text-secondary">Seleziona una foto già caricata per riutilizzarla su uno o più contenuti.</p>
      <button type="button" class="btn-secondary mt-4" @click="openPicker">Scegli dall'album</button>
    </div>

    <div
      v-if="open"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4"
      @click.self="open = false"
    >
      <div class="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div class="border-b border-gray-100 px-6 py-5">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p class="text-lg font-semibold text-text-primary">Album</p>
              <p class="mt-1 text-sm text-text-secondary">Scegli una foto già presente in libreria.</p>
            </div>
            <button type="button" class="btn-secondary" @click="open = false">Chiudi</button>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]">
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
            <div class="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                :class="viewMode === 'large' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary'"
                @click="viewMode = 'large'"
              >
                Large
              </button>
              <button
                type="button"
                class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                :class="viewMode === 'small' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary'"
                @click="viewMode = 'small'"
              >
                Small
              </button>
            </div>
          </div>
        </div>

        <div class="min-h-[320px] overflow-y-auto px-6 py-6">
          <div v-if="loading" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div v-for="n in 6" :key="n" class="h-64 animate-pulse rounded-2xl bg-gray-100" />
          </div>

          <div v-else-if="error" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {{ error }}
          </div>

          <div v-else-if="!filteredImages.length" class="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-10 text-center">
            <p class="text-sm font-medium text-text-primary">Nessuna immagine disponibile</p>
            <p class="mt-1 text-sm text-text-secondary">Prova a cambiare filtri oppure carica nuove foto nella sezione Album.</p>
          </div>

          <div
            v-else
            class="grid gap-4"
            :class="viewMode === 'small' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-3'"
          >
            <article
              v-for="image in filteredImages"
              :key="image.id"
              class="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div class="relative">
                <img
                  v-if="image.url"
                  :src="image.url"
                  :alt="image.title || image.displayName"
                  class="w-full object-cover"
                  :class="viewMode === 'small' ? 'h-36' : 'h-48'"
                />
                <div class="absolute right-3 top-3 inline-flex items-center rounded-full bg-slate-950/75 px-2.5 py-1 text-xs font-medium text-white">
                  {{ image.dependencyCount }}
                </div>
              </div>

              <div class="space-y-3 p-4">
                <div>
                  <p class="truncate text-sm font-semibold text-text-primary">{{ image.title || image.displayName }}</p>
                  <p class="mt-1 truncate text-xs text-text-secondary">{{ image.displayName }}</p>
                </div>

                <p v-if="viewMode === 'large' && image.description" class="line-clamp-2 text-sm text-text-secondary">
                  {{ image.description }}
                </p>

                <div class="flex items-center justify-between gap-3">
                  <span class="text-xs text-text-secondary">{{ formatFileSize(image.size) }}</span>
                  <button type="button" class="btn-primary px-3 py-1.5 text-xs" @click="selectImage(image)">
                    Seleziona
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
