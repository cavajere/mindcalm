import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const isDark = ref(false)
  const isOnline = ref(navigator.onLine)

  // Dark mode
  function initTheme() {
    const stored = localStorage.getItem('mindcalm-theme')
    if (stored) {
      isDark.value = stored === 'dark'
    } else {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    applyTheme()
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem('mindcalm-theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  function applyTheme() {
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  // Connectivity
  window.addEventListener('online', () => { isOnline.value = true })
  window.addEventListener('offline', () => { isOnline.value = false })

  return { isDark, isOnline, initTheme, toggleTheme }
})
