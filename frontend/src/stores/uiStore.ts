import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const isDark = ref(false)
  const isOnline = ref(navigator.onLine)
  const themePreference = ref<'light' | 'dark' | 'system'>('system')
  const systemTheme = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

  function initTheme() {
    const stored = localStorage.getItem('mindcalm-theme')
    themePreference.value = stored === 'light' || stored === 'dark' ? stored : 'system'
    syncTheme()
  }

  function toggleTheme() {
    themePreference.value = isDark.value ? 'light' : 'dark'
    localStorage.setItem('mindcalm-theme', themePreference.value)
    syncTheme()
  }

  function syncTheme() {
    isDark.value = themePreference.value === 'system'
      ? Boolean(systemTheme?.matches)
      : themePreference.value === 'dark'

    applyTheme()
  }

  function applyTheme() {
    document.documentElement.classList.toggle('dark', isDark.value)
    document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
  }

  systemTheme?.addEventListener('change', (event) => {
    if (themePreference.value === 'system') {
      isDark.value = event.matches
      applyTheme()
    }
  })

  window.addEventListener('storage', (event) => {
    if (event.key !== 'mindcalm-theme') return

    themePreference.value = event.newValue === 'light' || event.newValue === 'dark'
      ? event.newValue
      : 'system'
    syncTheme()
  })

  window.addEventListener('online', () => { isOnline.value = true })
  window.addEventListener('offline', () => { isOnline.value = false })

  return { isDark, isOnline, initTheme, toggleTheme }
})
