<script setup lang="ts">
import { computed } from 'vue'
import AppModal from './AppModal.vue'
import { useNotificationStore, type Notification } from '../stores/notificationStore'

const notificationStore = useNotificationStore()

const currentNotification = computed(() => notificationStore.notifications[0] || null)
const isOpen = computed(() => !!currentNotification.value)

function closeNotification() {
  if (currentNotification.value) {
    notificationStore.removeNotification(currentNotification.value.id)
  }
}

function getIcon(type: Notification['type']) {
  switch (type) {
    case 'success':
      return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    case 'error':
      return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
    case 'warning':
      return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z'
    default:
      return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  }
}

function getColors(type: Notification['type']) {
  switch (type) {
    case 'success':
      return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
    case 'warning':
      return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
    default:
      return 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
  }
}
</script>

<template>
  <AppModal
    :open="isOpen"
    panel-class="max-w-md"
    @close="closeNotification"
  >
    <div v-if="currentNotification" class="card p-6">
      <div class="flex items-start gap-4">
        <div class="flex-shrink-0">
          <div class="flex h-10 w-10 items-center justify-center rounded-full" :class="getColors(currentNotification.type)">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getIcon(currentNotification.type)" />
            </svg>
          </div>
        </div>
        
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-text-primary leading-6">
            {{ currentNotification.message }}
          </p>
        </div>
        
        <button
          type="button"
          class="flex-shrink-0 rounded-full p-1.5 text-text-secondary hover:bg-muted hover:text-text-primary transition-colors"
          @click="closeNotification"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div class="mt-6 flex justify-end">
        <button
          type="button"
          class="btn-primary"
          @click="closeNotification"
        >
          OK
        </button>
      </div>
    </div>
  </AppModal>
</template>