<script setup lang="ts">
import AdminModal from './AdminModal.vue'

withDefaults(defineProps<{
  open: boolean
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
}>(), {
  title: 'Conferma',
  message: 'Sei sicuro di voler procedere?',
  confirmLabel: 'Conferma',
  cancelLabel: 'Annulla',
  variant: 'danger',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <AdminModal :open="open" panel-class="max-w-md" :close-on-backdrop="false" @close="emit('cancel')">
    <div class="bg-white rounded-xl shadow-xl overflow-hidden">
      <div class="px-6 pt-6 pb-4">
        <div class="flex items-start gap-4">
          <div
            :class="[
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              variant === 'danger' ? 'bg-red-100' : variant === 'warning' ? 'bg-amber-100' : 'bg-primary/10',
            ]"
          >
            <svg
              v-if="variant === 'danger'"
              class="w-5 h-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <svg
              v-else-if="variant === 'warning'"
              class="w-5 h-5 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg
              v-else
              class="w-5 h-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-base font-semibold text-text-primary">{{ title }}</h3>
            <p class="mt-1 text-sm text-text-secondary leading-relaxed">{{ message }}</p>
          </div>
        </div>
      </div>
      <div class="px-6 py-4 bg-gray-50 flex justify-end gap-3">
        <button type="button" class="btn-secondary" @click="emit('cancel')">
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          :class="[
            variant === 'danger' ? 'btn-danger' : variant === 'warning' ? 'btn-warning' : 'btn-primary',
          ]"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </AdminModal>
</template>
