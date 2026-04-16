import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export interface TagSummary {
  id: string
  label: string
  slug: string
}

export interface Audio {
  id: string
  title: string
  description: string
  category: { id: string; name: string; color: string | null }
  level: string
  visibility: 'PUBLIC' | 'REGISTERED'
  durationSec: number
  coverImage: string | null
  publishedAt: string
  tags: TagSummary[]
}

export interface AudioDetail extends Audio {
  audioFormat: string
  audioSize: number
  streaming: {
    mode: 'session-playback'
    requiresOnline: boolean
    delivery: 'hls' | 'direct'
    processingStatus: 'PENDING' | 'READY' | 'FAILED'
    playbackSessionUrl: string
    minTokenTtlSec: number
  }
}

export interface Category {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  audioCount: number
}

export const useAudioStore = defineStore('audio', () => {
  const audioItems = ref<Audio[]>([])
  const categories = ref<Category[]>([])
  const loading = ref(false)
  const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })

  async function fetchAudio(params: Record<string, string> = {}) {
    loading.value = true
    try {
      const query = new URLSearchParams({ page: String(pagination.value.page), limit: String(pagination.value.limit), ...params })
      const { data } = await axios.get(`/api/audio?${query}`)
      audioItems.value = data.data
      pagination.value = data.pagination
    } finally {
      loading.value = false
    }
  }

  async function fetchAudioById(id: string): Promise<AudioDetail> {
    const { data } = await axios.get(`/api/audio/${id}`)
    return data
  }

  async function createPlaybackSession(id: string): Promise<{
    playbackType: 'hls' | 'direct'
    playbackUrl: string
    expiresAt: string
    expiresInSec: number
  }> {
    const { data } = await axios.post(`/api/audio/${id}/playback-session`)
    return data
  }

  async function fetchCategories() {
    const { data } = await axios.get('/api/categories')
    categories.value = data
  }

  return {
    audioItems,
    categories,
    loading,
    pagination,
    fetchAudio,
    fetchAudioById,
    createPlaybackSession,
    fetchCategories,
  }
})
