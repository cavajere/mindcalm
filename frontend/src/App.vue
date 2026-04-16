<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from './stores/uiStore'
import { useAudio } from './composables/useAudio'
import AudioPlayer from './components/AudioPlayer.vue'
import InstallPrompt from './components/InstallPrompt.vue'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import NotificationPopup from './components/NotificationPopup.vue'
import { usePlayerStore } from './stores/playerStore'

const ui = useUiStore()
const player = usePlayerStore()
const route = useRoute()

useAudio()

const showScrollTop = ref(false)

function handleScroll() {
  showScrollTop.value = window.scrollY > 400
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => window.addEventListener('scroll', handleScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', handleScroll))
</script>

<template>
  <div class="flex min-h-screen flex-col" :class="{ 'pb-24': player.currentAudio }">
    <AppHeader v-if="!route.meta.hideChrome" />

    <!-- Offline banner -->
    <div
      v-if="!route.meta.hideChrome && !ui.isOnline"
      class="border-b border-accent/20 bg-accent/12 px-4 py-2 text-center text-sm text-text-primary"
    >
      Sei offline — per ascoltare gli audio serve una connessione attiva
    </div>

    <!-- Main content -->
    <main class="relative flex-1 main-background">
      <router-view v-slot="{ Component, route: viewRoute }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="viewRoute.fullPath" />
        </transition>
      </router-view>
    </main>

    <AppFooter v-if="!route.meta.hideChrome" />
  </div>

  <!-- Scroll to top -->
  <transition name="scroll-top">
    <button
      v-if="showScrollTop && !route.meta.hideChrome"
      type="button"
      class="fixed z-30 flex h-10 w-10 items-center justify-center rounded-full border border-ui-border bg-surface/95 text-text-secondary shadow-lg backdrop-blur-sm transition-colors hover:bg-muted hover:text-text-primary"
      :class="player.currentAudio ? 'bottom-28 right-4' : 'bottom-6 right-4'"
      aria-label="Torna in cima"
      @click="scrollToTop"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  </transition>

  <!-- Global audio player -->
  <AudioPlayer v-if="!route.meta.hideChrome" />

  <!-- Install prompt -->
  <InstallPrompt v-if="!route.meta.hideChrome" />

  <!-- Global notifications -->
  <NotificationPopup />
</template>

<style>
.fade-enter-active {
  transition: opacity 0.15s ease;
}
.fade-leave-active {
  transition: opacity 0.1s ease;
  position: absolute;
  inset: 0;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.scroll-top-enter-active,
.scroll-top-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.scroll-top-enter-from,
.scroll-top-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
