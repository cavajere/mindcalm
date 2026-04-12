import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import axios from 'axios'

export type AdminAuthMode = 'anonymous' | 'bootstrap' | 'admin'

interface AdminUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STANDARD'
  isActive?: boolean
  isBootstrap?: boolean
}

interface AdminSessionResponse {
  authenticated: boolean
  mode: AdminAuthMode
  user: AdminUser | null
  bootstrapEnabled: boolean
  hasActiveAdmin: boolean
}

const LEGACY_TOKEN_STORAGE_KEY = 'mindcalm-admin-token'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AdminUser | null>(null)
  const mode = ref<AdminAuthMode>('anonymous')
  const initialized = ref(false)
  const bootstrapEnabled = ref(false)
  const hasActiveAdmin = ref(false)

  const isAuthenticated = computed(() => mode.value !== 'anonymous')
  const isBootstrapMode = computed(() => mode.value === 'bootstrap')
  const isAdminMode = computed(() => mode.value === 'admin')

  function clearLegacyToken() {
    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY)
  }

  function applySession(session: AdminSessionResponse) {
    mode.value = session.mode
    user.value = session.user
    bootstrapEnabled.value = session.bootstrapEnabled
    hasActiveAdmin.value = session.hasActiveAdmin
    initialized.value = true
    clearLegacyToken()
  }

  function clearSession() {
    applySession({
      authenticated: false,
      mode: 'anonymous',
      user: null,
      bootstrapEnabled: bootstrapEnabled.value,
      hasActiveAdmin: hasActiveAdmin.value,
    })
  }

  function getDefaultRoute() {
    return mode.value === 'bootstrap' ? '/setup' : '/'
  }

  async function fetchSession() {
    const { data } = await axios.get<AdminSessionResponse>('/api/v1/auth/session')
    applySession(data)
  }

  async function initialize() {
    if (initialized.value) return
    await fetchSession()
  }

  async function login(email: string, password: string) {
    const { data } = await axios.post<AdminSessionResponse>('/api/v1/auth/login', { email, password })
    applySession(data)
  }

  async function completeBootstrapSetup(payload: {
    email: string
    firstName: string
    lastName: string
    phone: string
    password: string
  }) {
    const { data } = await axios.post<AdminSessionResponse>('/api/v1/auth/bootstrap/setup', payload)
    applySession(data)
  }

  async function logout() {
    try {
      await axios.post('/api/v1/auth/logout')
    } finally {
      clearSession()
    }
  }

  return {
    user,
    mode,
    initialized,
    bootstrapEnabled,
    hasActiveAdmin,
    isAuthenticated,
    isBootstrapMode,
    isAdminMode,
    login,
    logout,
    initialize,
    fetchSession,
    completeBootstrapSetup,
    clearSession,
    getDefaultRoute,
  }
})
