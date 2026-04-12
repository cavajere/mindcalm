<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { getAudioLevelLabel } from '../utils/audioLevels'

const router = useRouter()
const audioItems = ref<any[]>([])
const loading = ref(true)
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })

async function fetchAudio() {
  loading.value = true
  try {
    const { data } = await axios.get(`/api/admin/audio?page=${pagination.value.page}&limit=${pagination.value.limit}`)
    audioItems.value = data.data
    pagination.value = { ...pagination.value, ...data.pagination }
  } finally {
    loading.value = false
  }
}

async function toggleStatus(audio: any) {
  const newStatus = audio.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
  await axios.patch(`/api/admin/audio/${audio.id}/status`, { status: newStatus })
  audio.status = newStatus
}

async function deleteAudio(audio: any) {
  if (!confirm(`Eliminare l'audio "${audio.title}"?`)) return
  await axios.delete(`/api/admin/audio/${audio.id}`)
  audioItems.value = audioItems.value.filter((item) => item.id !== audio.id)
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function processingLabel(status: string) {
  if (status === 'READY') return 'Pronto'
  if (status === 'PENDING') return 'In lavorazione'
  return 'Errore'
}

onMounted(fetchAudio)
</script>

<template>
  <div>
    <PageHeader
      title="Audio"
      description="Gestisci catalogo, stato di pubblicazione e delivery dei contenuti audio."
    >
      <template #actions>
        <router-link to="/audio/new" class="btn-primary">+ Nuovo audio</router-link>
      </template>
    </PageHeader>

    <div class="table-container">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Titolo</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Categoria</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Livello</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Durata</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Delivery</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Stato</th>
            <th class="table-actions-header px-4 py-3 text-xs font-medium text-text-secondary uppercase">Azioni</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="audio in audioItems" :key="audio.id" class="hover:bg-gray-50/50">
            <td class="px-4 py-3 text-sm font-medium text-text-primary">{{ audio.title }}</td>
            <td class="px-4 py-3">
              <span v-if="audio.category" class="text-xs px-2 py-1 rounded-full" :style="{ backgroundColor: (audio.category.color || '#4A90D9') + '20', color: audio.category.color || '#4A90D9' }">
                {{ audio.category.name }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ getAudioLevelLabel(audio.level) }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ formatDuration(audio.durationSec) }}</td>
            <td class="px-4 py-3">
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-text-primary">{{ audio.streamingFormat === 'HLS' ? 'HLS' : 'Diretto' }}</span>
                <span
                  :class="[
                    'text-xs',
                    audio.processingStatus === 'READY'
                      ? 'text-green-600'
                      : audio.processingStatus === 'PENDING'
                        ? 'text-amber-600'
                        : 'text-red-600',
                  ]"
                >
                  {{ processingLabel(audio.processingStatus) }}
                </span>
              </div>
            </td>
            <td class="px-4 py-3">
              <StatusBadge :status="audio.status" />
            </td>
            <td class="table-actions-cell">
              <div class="table-actions-group">
                <button
                  @click="toggleStatus(audio)"
                  class="icon-action-button icon-action-button-neutral"
                  :title="audio.status === 'PUBLISHED' ? 'Riporta a bozza' : 'Pubblica'"
                  :aria-label="audio.status === 'PUBLISHED' ? 'Riporta a bozza' : 'Pubblica'"
                >
                  <svg v-if="audio.status === 'PUBLISHED'" class="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                  </svg>
                  <svg v-else class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
                <button
                  @click="router.push(`/audio/${audio.id}/edit`)"
                  class="icon-action-button icon-action-button-neutral"
                  title="Modifica"
                  aria-label="Modifica"
                >
                  <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button
                  @click="deleteAudio(audio)"
                  class="icon-action-button icon-action-button-danger"
                  title="Elimina"
                  aria-label="Elimina"
                >
                  <svg class="w-4 h-4 text-red-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!audioItems.length && !loading">
            <td colspan="7" class="px-4 py-8 text-center text-text-secondary">Nessun audio</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
