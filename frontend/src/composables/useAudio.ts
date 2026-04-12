import { watch, onUnmounted } from 'vue'
import type Hls from 'hls.js'
import { usePlayerStore } from '../stores/playerStore'
import type { PlayingAudio } from '../stores/playerStore'
import { trackAudioComplete, trackAudioError, trackAudioPlay } from '../services/analyticsService'

let audio: HTMLAudioElement | null = null
let hls: Hls | null = null

export function useAudio() {
  const player = usePlayerStore()

  function destroyHlsInstance() {
    if (hls) {
      hls.destroy()
      hls = null
    }
  }

  function resetAudioSource() {
    if (!audio) return

    audio.pause()
    destroyHlsInstance()
    audio.src = ''
    audio.load()
  }

  function canUseNativeHls(): boolean {
    if (!audio) return false
    return audio.canPlayType('application/vnd.apple.mpegurl') !== ''
  }

  async function attachPlaybackSource(audioItem: PlayingAudio) {
    if (!audio) return

    if (audioItem.playbackType === 'hls') {
      if (canUseNativeHls()) {
        audio.src = audioItem.playbackUrl
      } else {
        const { default: HlsConstructor } = await import('hls.js')
        if (!HlsConstructor.isSupported()) {
          audio.src = audioItem.playbackUrl
          return
        }

        await new Promise<void>((resolve, reject) => {
          hls = new HlsConstructor({
            enableWorker: true,
            lowLatencyMode: false,
          })

          hls.on(HlsConstructor.Events.MEDIA_ATTACHED, () => {
            hls?.loadSource(audioItem.playbackUrl)
          })

          hls.on(HlsConstructor.Events.MANIFEST_PARSED, () => {
            resolve()
          })

          hls.on(HlsConstructor.Events.ERROR, (_event, data) => {
            if (!data.fatal) return

            player.isLoading = false
            player.isPlaying = false
            void trackAudioError(new Error(data.details || 'HLS playback error'), {
              audioId: audioItem.id,
              metadata: {
                source: 'hls-fatal-error',
                fatal: data.fatal,
                type: data.type,
                details: data.details,
              },
            })
            reject(new Error(data.details || 'HLS playback error'))
          })

          hls.attachMedia(audio!)
        })
      }
      return
    }

    audio.src = audioItem.playbackUrl
  }

  function initAudio() {
    if (audio) return

    audio = new Audio()

    audio.addEventListener('loadedmetadata', () => {
      player.duration = audio!.duration
      player.isLoading = false
    })

    audio.addEventListener('timeupdate', () => {
      player.currentTime = audio!.currentTime
    })

    audio.addEventListener('ended', () => {
      if (player.currentAudio?.id) {
        void trackAudioComplete(player.currentAudio.id)
      }
      player.isPlaying = false
      player.currentTime = 0
    })

    audio.addEventListener('waiting', () => {
      player.isLoading = true
    })

    audio.addEventListener('canplay', () => {
      player.isLoading = false
    })

    audio.addEventListener('error', () => {
      player.isLoading = false
      player.isPlaying = false

      const mediaError = audio?.error
      void trackAudioError(new Error(mediaError?.message || 'Audio element error'), {
        audioId: player.currentAudio?.id,
        metadata: {
          source: 'html-audio-error',
          code: mediaError?.code,
        },
      })
    })
  }

  // Watch per cambio audio
  watch(() => player.currentAudio, async (audioItem) => {
    if (!audioItem) {
      resetAudioSource()
      return
    }
    initAudio()
    resetAudioSource()
    try {
      await attachPlaybackSource(audioItem)
      await audio!.play()
      void trackAudioPlay(audioItem.id)
    } catch (error) {
      void trackAudioError(error, {
        audioId: audioItem.id,
        metadata: {
          source: 'audio-watch-playback-start',
          playbackType: audioItem.playbackType,
        },
      })
      player.isPlaying = false
    }
  })

  // Watch per play/pause
  watch(() => player.isPlaying, (playing) => {
    if (!audio || !audio.src) return
    if (playing) {
      audio.play().catch((error) => {
        void trackAudioError(error, {
          audioId: player.currentAudio?.id,
          metadata: {
            source: 'audio-play-promise',
          },
        })
        player.isPlaying = false
      })
    } else {
      audio.pause()
    }
  })

  // Watch per seek
  watch(() => player.currentTime, (time) => {
    if (!audio) return
    if (Math.abs(audio.currentTime - time) > 1) {
      audio.currentTime = time
    }
  })

  // Watch per volume
  watch(() => player.volume, (vol) => {
    if (audio) audio.volume = vol
  })

  onUnmounted(() => {
    resetAudioSource()
  })

  return { player }
}
