<script setup lang="ts">
import type { Toast, ToastVariant } from '../stores/uiStore'

defineProps<{ toast: Toast }>()
defineEmits<{ dismiss: [] }>()

const variantStyles: Record<ToastVariant, { border: string; icon: string; bar: string }> = {
  success: { border: 'border-l-emerald-500', icon: 'text-emerald-500', bar: 'bg-emerald-500' },
  error: { border: 'border-l-red-500', icon: 'text-red-500', bar: 'bg-red-500' },
  warning: { border: 'border-l-amber-500', icon: 'text-amber-500', bar: 'bg-amber-500' },
  info: { border: 'border-l-sky-500', icon: 'text-sky-500', bar: 'bg-sky-500' },
}
</script>

<template>
  <div
    class="relative overflow-hidden rounded-xl border border-slate-200 border-l-4 bg-white shadow-lg"
    :class="variantStyles[toast.variant].border"
    role="alert"
  >
    <div class="flex items-start gap-3 px-4 py-3">
      <div class="mt-0.5 shrink-0" :class="variantStyles[toast.variant].icon">
        <!-- success -->
        <svg v-if="toast.variant === 'success'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <!-- error -->
        <svg v-else-if="toast.variant === 'error'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <!-- warning -->
        <svg v-else-if="toast.variant === 'warning'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <!-- info -->
        <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <p class="min-w-0 flex-1 text-sm leading-relaxed text-slate-900">{{ toast.message }}</p>

      <button
        type="button"
        class="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        @click="$emit('dismiss')"
        aria-label="Chiudi"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="h-0.5 w-full bg-slate-100">
      <div
        class="h-full animate-toast-countdown"
        :class="variantStyles[toast.variant].bar"
        :style="{ animationDuration: `${toast.autoDismissMs}ms` }"
      />
    </div>
  </div>
</template>
