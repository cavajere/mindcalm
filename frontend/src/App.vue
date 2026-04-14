<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useUiStore } from './stores/uiStore'
import { useAudio } from './composables/useAudio'
import AudioPlayer from './components/AudioPlayer.vue'
import InstallPrompt from './components/InstallPrompt.vue'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import { usePlayerStore } from './stores/playerStore'

const ui = useUiStore()
const player = usePlayerStore()
const route = useRoute()

useAudio()
</script>

<template>
  <AppHeader v-if="!route.meta.hideChrome" />

  <!-- Offline banner -->
  <div
    v-if="!route.meta.hideChrome && !ui.isOnline"
    class="border-b border-accent/20 bg-accent/12 px-4 py-2 text-center text-sm text-text-primary"
  >
    Sei offline — per ascoltare gli audio serve una connessione attiva
  </div>

  <!-- Main content -->
  <main :class="{ 'pb-24': player.currentAudio }">
    <router-view v-slot="{ Component, route }">
      <transition name="fade" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </router-view>
  </main>

  <AppFooter v-if="!route.meta.hideChrome" :class="{ 'pb-24': player.currentAudio }" />

  <!-- Global audio player -->
  <AudioPlayer v-if="!route.meta.hideChrome" />

  <!-- Install prompt -->
  <InstallPrompt v-if="!route.meta.hideChrome" />
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
