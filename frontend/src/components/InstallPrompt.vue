<script setup lang="ts">
import { useInstall } from '../composables/useInstall'

const { canInstall, install } = useInstall()
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="canInstall"
      class="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40 card p-4 shadow-lg"
    >
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 bg-primary rounded-lg flex-shrink-0 flex items-center justify-center">
          <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a4 4 0 00-4 4v1a2 2 0 00-2 2v5a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2V6a4 4 0 00-4-4z"/>
          </svg>
        </div>
        <div class="flex-1">
          <p class="font-medium text-text-primary text-sm">Installa MindCalm</p>
          <p class="text-xs text-text-secondary mt-1">Aggiungi alla schermata home per un accesso rapido</p>
          <div class="flex gap-2 mt-3">
            <button @click="install" class="px-3 py-1.5 bg-primary text-white text-xs rounded-lg font-medium">
              Installa
            </button>
            <button @click="canInstall = false" class="px-3 py-1.5 text-text-secondary text-xs rounded-lg font-medium">
              Non ora
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>
