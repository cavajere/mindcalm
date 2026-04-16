<script setup lang="ts">
import { useUiStore } from '../stores/uiStore'
import AppToastItem from './AppToastItem.vue'

const ui = useUiStore()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed bottom-4 left-4 right-4 z-[80] flex flex-col-reverse gap-2 sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:w-96 sm:flex-col"
      aria-live="polite"
      aria-atomic="false"
    >
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-y-4 opacity-0 sm:translate-y-0 sm:-translate-y-4"
        enter-to-class="translate-y-0 opacity-100 sm:translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
        move-class="transition-all duration-300 ease-out"
      >
        <AppToastItem
          v-for="toast in ui.toasts"
          :key="toast.id"
          :toast="toast"
          @dismiss="ui.removeToast(toast.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>
