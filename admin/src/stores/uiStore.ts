import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  variant: ToastVariant
  message: string
  autoDismissMs: number
  createdAt: number
}

const MAX_VISIBLE_TOASTS = 3

let nextId = 0

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const activeRequestCount = ref(0)
  const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const isLoading = computed(() => activeRequestCount.value > 0)

  function addToast(variant: ToastVariant, message: string, autoDismissMs: number): string {
    const id = String(++nextId)
    const toast: Toast = { id, variant, message, autoDismissMs, createdAt: Date.now() }

    toasts.value.push(toast)

    while (toasts.value.length > MAX_VISIBLE_TOASTS) {
      const oldest = toasts.value[0]
      removeToast(oldest.id)
    }

    const timer = setTimeout(() => removeToast(id), autoDismissMs)
    dismissTimers.set(id, timer)

    return id
  }

  function removeToast(id: string) {
    const timer = dismissTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      dismissTimers.delete(id)
    }

    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  function incrementRequests() {
    activeRequestCount.value++
  }

  function decrementRequests() {
    activeRequestCount.value = Math.max(0, activeRequestCount.value - 1)
  }

  return {
    toasts,
    activeRequestCount,
    isLoading,
    addToast,
    removeToast,
    incrementRequests,
    decrementRequests,
  }
})
