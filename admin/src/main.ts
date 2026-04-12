import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/authStore'
import './assets/styles/main.css'

const pinia = createPinia()
const app = createApp(App)

axios.defaults.withCredentials = true

app.use(pinia)
app.use(router)

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const requestUrl = error.config?.url || ''
    const normalizedPath = requestUrl.startsWith('http') ? new URL(requestUrl).pathname : requestUrl
    const isPublicAuthRequest = [
      '/api/v1/auth/login',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
    ].includes(normalizedPath)

    if ((status === 401 || status === 403) && !isPublicAuthRequest) {
      const auth = useAuthStore(pinia)
      auth.clearSession()
      await auth.fetchSession().catch(() => undefined)

      if (!router.currentRoute.value.meta.publicOnly) {
        await router.push({
          path: '/login',
          query: router.currentRoute.value.fullPath !== '/' ? { redirect: router.currentRoute.value.fullPath } : {},
        })
      }
    }

    return Promise.reject(error)
  },
)

app.mount('#app')
