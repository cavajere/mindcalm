<script setup lang="ts">
import { usePlayerStore } from '../stores/playerStore'

const player = usePlayerStore()

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function handleSeek(e: MouseEvent) {
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  player.seek(pct * player.duration)
}

function handleTouchSeek(e: TouchEvent) {
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const pct = (e.touches[0].clientX - rect.left) / rect.width
  player.seek(Math.max(0, Math.min(1, pct)) * player.duration)
}
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="player.currentAudio"
      class="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom px-3 pb-3"
    >
      <div class="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-ui-border/80 bg-surface/95 shadow-2xl backdrop-blur">
        <div class="px-4 pt-4 sm:px-5">
          <div class="flex items-start gap-3">
            <router-link
              :to="`/audio/${player.currentAudio.id}`"
              class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20"
            >
              <img
                v-if="player.currentAudio.coverImage"
                :src="player.currentAudio.coverImage"
                :alt="player.currentAudio.title"
                class="h-full w-full object-cover"
              />
              <div v-else class="flex h-full w-full items-center justify-center text-primary/70">
                <svg class="h-7 w-7" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/>
                </svg>
              </div>
            </router-link>

            <div class="min-w-0 flex-1 pt-1">
              <router-link
                :to="`/audio/${player.currentAudio.id}`"
                class="block truncate text-sm font-semibold text-text-primary transition-colors hover:text-primary sm:text-base"
              >
                {{ player.currentAudio.title }}
              </router-link>
              <p class="mt-1 text-xs text-text-secondary">
                Riproduzione in corso
              </p>
            </div>

            <button
              @click="player.stop()"
              class="rounded-full p-2 text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary"
              aria-label="Chiudi player"
              title="Chiudi player"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="mt-4">
            <div
              class="group relative h-3 cursor-pointer rounded-full bg-gray-200/80"
              @click="handleSeek"
              @touchmove.prevent="handleTouchSeek"
            >
              <div
                class="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-200"
                :style="{ width: `${player.progress}%` }"
              ></div>
              <div
                class="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-sm transition-all duration-200"
                :style="{ left: `calc(${player.progress}% - 0.5rem)` }"
              ></div>
            </div>

            <div class="mt-2 flex items-center justify-between text-[11px] font-medium text-text-secondary">
              <span>{{ formatTime(player.currentTime) }}</span>
              <span>{{ formatTime(player.duration) }}</span>
            </div>
          </div>
        </div>

        <div class="mt-4 flex items-center justify-center gap-3 border-t border-ui-border/80 px-4 py-4 sm:gap-4 sm:px-5">
          <button
            @click="player.seekBy(-15)"
            class="player-skip-button"
            aria-label="Indietro di 15 secondi"
            title="Indietro di 15 secondi"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8V4L7 9l5 5v-4c3.314 0 6 2.686 6 6 0 .34-.028.674-.083 1"/>
            </svg>
            <span class="text-[10px] font-semibold tracking-[0.12em]">15</span>
          </button>

          <button
            @click="player.togglePlay()"
            class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary-dark active:scale-[0.98] sm:h-16 sm:w-16"
            aria-label="Play o pausa"
            title="Play o pausa"
          >
            <svg v-if="player.isLoading" class="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <svg v-else-if="player.isPlaying" class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <svg v-else class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
            </svg>
          </button>

          <button
            @click="player.seekBy(15)"
            class="player-skip-button"
            aria-label="Avanti di 15 secondi"
            title="Avanti di 15 secondi"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8V4l5 5-5 5v-4c-3.314 0-6 2.686-6 6 0 .34.028.674.083 1"/>
            </svg>
            <span class="text-[10px] font-semibold tracking-[0.12em]">15</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.player-skip-button {
  display: inline-flex;
  height: 3rem;
  width: 3rem;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.05rem;
  border-radius: 9999px;
  border: 1px solid rgb(226 232 240 / 0.9);
  color: rgb(107 124 141);
  transition: all 0.2s ease;
}

.player-skip-button:hover {
  background: rgb(248 250 252 / 0.95);
  color: rgb(26 43 60);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.32s ease, opacity 0.32s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
