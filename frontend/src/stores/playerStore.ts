import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface PlayingAudio {
  id: string
  title: string
  playbackType: 'hls' | 'direct'
  playbackUrl: string
  coverImage: string | null
  durationSec: number
  streamExpiresAt: string
}

export const usePlayerStore = defineStore('player', () => {
  const currentAudio = ref<PlayingAudio | null>(null)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(1)
  const isLoading = ref(false)

  const progress = computed(() => {
    if (duration.value === 0) return 0
    return (currentTime.value / duration.value) * 100
  })

  function play(audio: PlayingAudio) {
    currentAudio.value = audio
    isPlaying.value = true
    isLoading.value = true
  }

  function togglePlay() {
    isPlaying.value = !isPlaying.value
  }

  function stop() {
    currentAudio.value = null
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
  }

  function seek(time: number) {
    currentTime.value = Math.max(0, Math.min(time, duration.value || 0))
  }

  function seekBy(deltaSeconds: number) {
    seek(currentTime.value + deltaSeconds)
  }

  return {
    currentAudio,
    isPlaying,
    currentTime,
    duration,
    volume,
    isLoading,
    progress,
    play,
    togglePlay,
    stop,
    seek,
    seekBy,
  }
})
