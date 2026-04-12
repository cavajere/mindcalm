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
  const token = ref<string | null>(localStorage.getItem('mindcalm-admin-token'))
  const user = ref<AdminUser | null>(null)

  const isAuthenticated = computed(() => !!token.value)

  // Setup axios interceptor
  axios.interceptors.request.use((config) => {
    if (token.value) {
      config.headers.Authorization = `Bearer ${token.value}`
    }
    return config
  })

  async function login(email: string, password: string) {
    const { data } = await axios.post('/api/v1/auth/login', { email, password })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('mindcalm-admin-token', data.token)
  }

  async function fetchMe() {
    if (!token.value) return
    try {
      const { data } = await axios.get('/api/v1/auth/me')
      user.value = data
    } catch {
      await logout()
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await axios.post('/api/v1/auth/logout')
      }
    } catch {
      // Il logout locale deve comunque completarsi anche se l'API non risponde.
    } finally {
      token.value = null
      user.value = null
      localStorage.removeItem('mindcalm-admin-token')
    }
  }

  return { token, user, isAuthenticated, login, fetchMe, logout }
})
