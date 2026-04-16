<script setup lang="ts">
import { useUiStore } from '../stores/uiStore'

const ui = useUiStore()
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-500"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="ui.isLoading"
      class="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-primary/20"
    >
      <div class="h-full animate-loading-bar bg-primary" />
    </div>
  </Transition>
</template>
