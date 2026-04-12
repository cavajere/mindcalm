import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

interface AdminUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STANDARD'
  isActive?: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AdminUser | null>(null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  function clearLegacyToken() {
    localStorage.removeItem('mindcalm-admin-token')
  }

  function clearSession() {
    user.value = null
    initialized.value = true
    clearLegacyToken()
  }

  async function login(email: string, password: string) {
    const { data } = await axios.post('/api/v1/auth/login', { email, password })
    user.value = data.user
    initialized.value = true
    clearLegacyToken()
  }

  async function fetchMe() {
    try {
      const { data } = await axios.get('/api/v1/auth/me')
      user.value = data
    } catch {
      clearSession()
      return
    } finally {
      initialized.value = true
    }
  }

  async function initialize() {
    if (initialized.value) return
    await fetchMe()
  }

  async function logout() {
    try {
      await axios.post('/api/v1/auth/logout')
    } catch {
      // Il logout locale deve comunque completarsi anche se l'API non risponde.
    } finally {
      clearSession()
    }
  }

  return { user, initialized, isAuthenticated, login, fetchMe, initialize, logout, clearSession }
})
