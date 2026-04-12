import { computed } from 'vue'
import { useUiStore } from '../stores/uiStore'

export function useOffline() {
  const ui = useUiStore()

  const isOnline = computed(() => ui.isOnline)
  const isOffline = computed(() => !ui.isOnline)

  return { isOnline, isOffline }
}
