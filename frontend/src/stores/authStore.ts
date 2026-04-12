import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'
import { usePlayerStore } from './playerStore'
import {
  clearActiveProtectedUserId,
  clearProtectedOfflineData,
  getActiveProtectedUserId,
  setActiveProtectedUserId,
} from '../utils/protectedOffline'

interface AppUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STANDARD'
  isActive?: boolean
}

const USER_SNAPSHOT_STORAGE_KEY = 'mindcalm-app-user'

export const useAuthStore = defineStore('app-auth', () => {
  const user = ref<AppUser | null>(null)
  const initialized = ref(false)
  const isAuthenticated = computed(() => !!user.value)

  function saveUserSnapshot(nextUser: AppUser) {
    localStorage.setItem(USER_SNAPSHOT_STORAGE_KEY, JSON.stringify(nextUser))
  }

  function loadUserSnapshot(): AppUser | null {
    const stored = localStorage.getItem(USER_SNAPSHOT_STORAGE_KEY)
    if (!stored) return null

    try {
      return JSON.parse(stored) as AppUser
    } catch {
      clearUserSnapshot()
      return null
    }
  }

  function clearUserSnapshot() {
    localStorage.removeItem(USER_SNAPSHOT_STORAGE_KEY)
  }

  async function syncProtectedOfflineState(nextUser: AppUser | null) {
    const previousUserId = getActiveProtectedUserId()
    const nextUserId = nextUser?.id ?? null

    if (previousUserId && nextUserId && previousUserId !== nextUserId) {
      await clearProtectedOfflineData(previousUserId)
    }

    if (!nextUserId) {
      if (previousUserId) {
        await clearProtectedOfflineData(previousUserId)
      }
      clearActiveProtectedUserId()
      clearUserSnapshot()
    } else {
      const snapshotUser = nextUser as AppUser
      setActiveProtectedUserId(nextUserId)
      saveUserSnapshot(snapshotUser)
    }

    if (previousUserId !== nextUserId) {
      usePlayerStore().stop()
    }
  }

  async function login(email: string, password: string) {
    const { data } = await axios.post('/api/v1/auth/app-login', { email, password })
    user.value = data.user
    await syncProtectedOfflineState(user.value)
    initialized.value = true
  }

  async function fetchMe() {
    try {
      const { data } = await axios.get('/api/v1/auth/app-me')
      user.value = data
      await syncProtectedOfflineState(user.value)
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        user.value = loadUserSnapshot()
      } else {
        user.value = null
        await syncProtectedOfflineState(null)
      }
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
      await axios.post('/api/v1/auth/app-logout')
    } finally {
      user.value = null
      await syncProtectedOfflineState(null)
      initialized.value = true
    }
  }

  return { user, initialized, isAuthenticated, login, fetchMe, initialize, logout }
})
