<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'

type StorageStatus = 'DRAFT' | 'PUBLISHED' | null

type StorageLinkedEntity = {
  type: 'AUDIO' | 'ARTICLE'
  entityId: string
  label: string
  path: string
  status: StorageStatus
}

type StorageLargestItem = {
  area: 'audio' | 'images' | 'hls'
  areaLabel: string
  kind: 'FILE' | 'DIRECTORY'
  sourceType: 'AUDIO_FILE' | 'AUDIO_COVER' | 'THOUGHT_COVER' | 'ALBUM_IMAGE' | 'HLS_PACKAGE' | 'UNTRACKED'
  sourceLabel: string
  name: string
  relativePath: string
  absolutePath: string
  extension: string | null
  size: number
  fileCount: number
  relatedEntities: StorageLinkedEntity[]
}

type StorageAreaOverview = {
  key: 'audio' | 'images' | 'hls'
  label: string
  rootPath: string
  totalSize: number
  entryCount: number
  fileCount: number
  linkedEntryCount: number
  unlinkedEntryCount: number
  largestItem: StorageLargestItem | null
}

type StorageOverview = {
  generatedAt: string
  totalSize: number
  totalEntries: number
  totalPhysicalFiles: number
  linkedEntries: number
  unlinkedEntries: number
  areas: StorageAreaOverview[]
  largestItems: StorageLargestItem[]
}

type PaginatedStorageItems = {
  data: StorageLargestItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const loading = ref(true)
const refreshing = ref(false)
const unlinkedLoading = ref(false)
const error = ref('')
const overview = ref<StorageOverview | null>(null)
const unlinkedItems = ref<StorageLargestItem[]>([])
const unlinkedPagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
})

const summaryCards = computed(() => {
  if (!overview.value) return []

  return [
    {
      label: 'Spazio totale',
      value: formatSize(overview.value.totalSize),
      hint: `${overview.value.totalEntries} elementi rilevati`,
    },
    {
      label: 'File fisici',
      value: overview.value.totalPhysicalFiles.toLocaleString('it-IT'),
      hint: 'File reali presenti nello storage',
    },
    {
      label: 'Elementi collegati',
      value: overview.value.linkedEntries.toLocaleString('it-IT'),
      hint: 'Con almeno un contenuto collegato',
    },
    {
      label: 'Da verificare',
      value: overview.value.unlinkedEntries.toLocaleString('it-IT'),
      hint: 'Elementi senza collegamenti applicativi',
    },
  ]
})

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

function formatFilesLabel(count: number) {
  return count === 1 ? '1 file' : `${count.toLocaleString('it-IT')} file`
}

function getAreaShare(size: number) {
  if (!overview.value?.totalSize) return 0
  return Math.round((size / overview.value.totalSize) * 100)
}

function statusLabel(status: StorageStatus) {
  if (status === 'PUBLISHED') return 'Pubblicato'
  if (status === 'DRAFT') return 'Bozza'
  return 'N/D'
}

function statusClasses(status: StorageStatus) {
  if (status === 'PUBLISHED') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
  }

  if (status === 'DRAFT') {
    return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
  }

  return 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200'
}

function itemKindLabel(item: StorageLargestItem) {
  if (item.kind === 'DIRECTORY') {
    return `Pacchetto (${formatFilesLabel(item.fileCount)})`
  }

  return item.extension ? item.extension.toUpperCase() : 'FILE'
}

async function fetchOverview(background = false) {
  if (background) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  error.value = ''

  try {
    const { data } = await axios.get<StorageOverview>('/api/admin/settings/storage')
    overview.value = data
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Caricamento riepilogo storage fallito'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function fetchUnlinkedItems(page = 1, background = false) {
  if (background) {
    unlinkedLoading.value = true
  }

  try {
    const { data } = await axios.get<PaginatedStorageItems>('/api/admin/settings/storage/unlinked', {
      params: {
        page,
        limit: unlinkedPagination.value.limit,
      },
    })
    unlinkedItems.value = data.data
    unlinkedPagination.value = data.pagination
  } finally {
    unlinkedLoading.value = false
  }
}

async function refreshAll(background = false) {
  if (!background) {
    loading.value = true
  }

  error.value = ''

  try {
    await Promise.all([
      fetchOverview(background),
      fetchUnlinkedItems(unlinkedPagination.value.page, true),
    ])
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Caricamento riepilogo storage fallito'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function changeUnlinkedPage(page: number) {
  if (page < 1 || page > unlinkedPagination.value.totalPages || page === unlinkedPagination.value.page) {
    return
  }

  void fetchUnlinkedItems(page, true)
}

onMounted(() => {
  refreshAll()
})
</script>

<template>
  <div>
    <PageHeader
      title="Storage"
      description="Panoramica dello spazio occupato da audio, immagini e pacchetti HLS, con dettaglio dei file più pesanti e dei contenuti collegati."
    >
      <template #actions>
        <button class="btn-secondary" :disabled="refreshing || unlinkedLoading" @click="refreshAll(true)">
          {{ refreshing ? 'Aggiornamento...' : 'Aggiorna' }}
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ error }}
    </div>

    <div v-if="loading && !overview" class="card text-sm text-text-secondary">
      Analisi storage in corso...
    </div>

    <template v-else-if="overview">
      <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div v-for="card in summaryCards" :key="card.label" class="card">
          <p class="mb-1 text-sm text-text-secondary">{{ card.label }}</p>
          <p class="text-3xl font-bold text-text-primary">{{ card.value }}</p>
          <p class="mt-2 text-sm text-text-secondary">{{ card.hint }}</p>
        </div>
      </div>

      <div class="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div v-for="area in overview.areas" :key="area.key" class="card">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium text-text-secondary">{{ area.label }}</p>
              <p class="mt-1 text-2xl font-semibold text-text-primary">{{ formatSize(area.totalSize) }}</p>
            </div>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {{ getAreaShare(area.totalSize) }}%
            </span>
          </div>

          <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-primary" :style="{ width: `${getAreaShare(area.totalSize)}%` }" />
          </div>

          <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-lg bg-slate-50 px-3 py-2">
              <dt class="text-text-secondary">Elementi</dt>
              <dd class="mt-1 font-semibold text-text-primary">{{ area.entryCount }}</dd>
            </div>
            <div class="rounded-lg bg-slate-50 px-3 py-2">
              <dt class="text-text-secondary">File fisici</dt>
              <dd class="mt-1 font-semibold text-text-primary">{{ area.fileCount }}</dd>
            </div>
            <div class="rounded-lg bg-slate-50 px-3 py-2">
              <dt class="text-text-secondary">Collegati</dt>
              <dd class="mt-1 font-semibold text-emerald-700">{{ area.linkedEntryCount }}</dd>
            </div>
            <div class="rounded-lg bg-slate-50 px-3 py-2">
              <dt class="text-text-secondary">Da verificare</dt>
              <dd class="mt-1 font-semibold text-amber-700">{{ area.unlinkedEntryCount }}</dd>
            </div>
          </dl>

          <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p class="text-xs font-medium uppercase tracking-[0.16em] text-text-secondary">Percorso</p>
            <p class="mt-2 break-all font-mono text-xs text-text-primary">{{ area.rootPath }}</p>
          </div>

          <div v-if="area.largestItem" class="mt-4 rounded-lg border border-slate-200 px-3 py-3">
            <p class="text-xs font-medium uppercase tracking-[0.16em] text-text-secondary">Elemento piu pesante</p>
            <p class="mt-2 text-sm font-semibold text-text-primary">{{ area.largestItem.name }}</p>
            <p class="mt-1 text-sm text-text-secondary">
              {{ formatSize(area.largestItem.size) }} · {{ itemKindLabel(area.largestItem) }}
            </p>
          </div>
        </div>
      </div>

      <div class="card mb-6">
        <div class="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-text-primary">Elementi che occupano di piu</h2>
            <p class="mt-1 text-sm text-text-secondary">
              Ultima analisi: {{ formatDateTime(overview.generatedAt) }}
            </p>
          </div>
          <p class="text-sm text-text-secondary">Top {{ overview.largestItems.length }} elementi per spazio occupato.</p>
        </div>

        <div class="table-container">
          <table class="min-w-full divide-y divide-gray-100 text-sm">
            <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th class="px-4 py-3">Elemento</th>
                <th class="px-4 py-3">Area</th>
                <th class="px-4 py-3">Spazio</th>
                <th class="px-4 py-3">Elementi collegati</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white align-top">
              <tr v-for="item in overview.largestItems" :key="`${item.area}:${item.relativePath}`">
                <td class="px-4 py-4">
                  <div class="flex flex-col gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-semibold text-text-primary">{{ item.name }}</p>
                      <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {{ itemKindLabel(item) }}
                      </span>
                      <span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {{ item.sourceLabel }}
                      </span>
                    </div>
                    <p class="font-mono text-xs text-text-secondary">{{ item.relativePath }}</p>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <div class="flex flex-col gap-1">
                    <span class="font-medium text-text-primary">{{ item.areaLabel }}</span>
                    <span class="text-xs text-text-secondary">{{ item.area.toUpperCase() }}</span>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <div class="flex flex-col gap-1">
                    <span class="font-semibold text-text-primary">{{ formatSize(item.size) }}</span>
                    <span class="text-xs text-text-secondary">{{ formatFilesLabel(item.fileCount) }}</span>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <div v-if="item.relatedEntities.length" class="flex flex-wrap gap-2">
                    <router-link
                      v-for="entity in item.relatedEntities"
                      :key="`${entity.type}:${entity.entityId}`"
                      :to="entity.path"
                      class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                    >
                      <span>{{ entity.type === 'AUDIO' ? 'Audio' : 'Pensiero' }}: {{ entity.label }}</span>
                      <span :class="statusClasses(entity.status)" class="rounded-full px-2 py-0.5 text-[11px] font-semibold">
                        {{ statusLabel(entity.status) }}
                      </span>
                    </router-link>
                  </div>
                  <p v-else class="text-sm text-amber-700">
                    Nessun elemento collegato
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="mb-4">
          <h2 class="text-lg font-semibold text-text-primary">Elementi da verificare</h2>
          <p class="mt-1 text-sm text-text-secondary">
            File o directory presenti nello storage ma senza collegamenti applicativi rilevati. La lista e paginata lato server.
          </p>
        </div>

        <div class="table-container">
          <table class="min-w-full divide-y divide-gray-100 text-sm">
            <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th class="px-4 py-3">Elemento</th>
                <th class="px-4 py-3">Area</th>
                <th class="px-4 py-3">Spazio</th>
                <th class="px-4 py-3">Percorso</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white align-top">
              <tr v-if="unlinkedLoading">
                <td colspan="4" class="px-4 py-8 text-center text-text-secondary">
                  Caricamento...
                </td>
              </tr>
              <tr v-else-if="!unlinkedItems.length">
                <td colspan="4" class="px-4 py-8 text-center text-text-secondary">
                  Nessun elemento da verificare
                </td>
              </tr>
              <tr v-for="item in unlinkedItems" :key="`unlinked:${item.area}:${item.relativePath}`">
                <td class="px-4 py-4">
                  <div class="flex flex-col gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-semibold text-text-primary">{{ item.name }}</p>
                      <span class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        {{ itemKindLabel(item) }}
                      </span>
                    </div>
                    <p class="text-xs text-text-secondary">{{ item.sourceLabel }}</p>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {{ item.areaLabel }}
                  </span>
                </td>
                <td class="px-4 py-4 font-semibold text-text-primary">
                  {{ formatSize(item.size) }}
                </td>
                <td class="px-4 py-4">
                  <p class="break-all font-mono text-xs text-text-secondary">{{ item.relativePath }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="unlinkedPagination.totalPages > 1" class="mt-4 flex items-center justify-between gap-4">
          <p class="text-sm text-text-secondary">
            Pagina {{ unlinkedPagination.page }} di {{ unlinkedPagination.totalPages }} · {{ unlinkedPagination.total }} elementi
          </p>

          <div class="flex items-center gap-2">
            <button class="btn-secondary" :disabled="unlinkedPagination.page <= 1 || unlinkedLoading" @click="changeUnlinkedPage(unlinkedPagination.page - 1)">
              Precedente
            </button>
            <button class="btn-secondary" :disabled="unlinkedPagination.page >= unlinkedPagination.totalPages || unlinkedLoading" @click="changeUnlinkedPage(unlinkedPagination.page + 1)">
              Successiva
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
