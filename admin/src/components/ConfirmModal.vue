<script setup lang="ts">
import AdminModal from './AdminModal.vue'
import { useConfirm } from '../composables/useConfirm'

const { visible, options, accept, cancel } = useConfirm()
</script>

<template>
  <AdminModal :open="visible" panel-class="max-w-md" :close-on-backdrop="false" @close="cancel">
    <div class="rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div class="px-6 pt-6 pb-4">
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          :class="[
            options.variant === 'danger'
              ? 'bg-red-100'
              : options.variant === 'warning'
                ? 'bg-amber-100'
                : 'bg-slate-100',
          ]"
        >
          <svg
            v-if="options.variant === 'danger'"
            class="h-6 w-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <svg
            v-else-if="options.variant === 'warning'"
            class="h-6 w-6 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <svg
            v-else
            class="h-6 w-6 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
            />
          </svg>
        </div>

        <p class="text-center text-sm text-slate-700">{{ options.message }}</p>
      </div>

      <div class="flex gap-3 border-t border-slate-100 px-6 py-4">
        <button
          type="button"
          class="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          @click="cancel"
        >
          {{ options.cancelLabel || 'Annulla' }}
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition"
          :class="[
            options.variant === 'danger'
              ? 'bg-red-600 hover:bg-red-700'
              : options.variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-slate-900 hover:bg-slate-800',
          ]"
          @click="accept"
        >
          {{ options.confirmLabel || 'Conferma' }}
        </button>
      </div>
    </div>
  </AdminModal>
</template>
