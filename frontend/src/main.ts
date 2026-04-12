import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/authStore'
import { trackApiError, trackAppError } from './services/analyticsService'
import './assets/styles/main.css'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)

function normalizeRequestPath(requestUrl?: string) {
  if (!requestUrl) return ''

  try {
    return new URL(requestUrl, window.location.origin).pathname
  } catch {
    return requestUrl
  }
}

function shouldTrackAxiosError(error: unknown) {
  if (!axios.isAxiosError(error)) return false
  if (error.code === 'ERR_CANCELED') return false

  const normalizedPath = normalizeRequestPath(error.config?.url)
  if (normalizedPath === '/api/analytics/events') return false
  if (normalizedPath === '/api/auth/app-me' && error.response?.status === 401) return false

  return true
}

app.config.errorHandler = (error, instance, info) => {
  void trackAppError(error, {
    metadata: {
      source: 'vue-error-handler',
      info,
      componentName: instance?.$options?.name || 'anonymous-component',
    },
  })

  console.error(error)
}

window.addEventListener('error', (event) => {
  const target = event.target
  const isResourceError = target instanceof HTMLElement && target !== window.document.documentElement

  if (isResourceError) {
    void trackAppError(new Error('Resource load error'), {
      metadata: {
        source: 'window-resource-error',
        tagName: target.tagName,
        resourceUrl: 'currentSrc' in target ? target.currentSrc : target.getAttribute('src') || target.getAttribute('href'),
      },
    })
    return
  }

  void trackAppError(event.error || new Error(event.message || 'Window error'), {
    metadata: {
      source: 'window-error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    },
  })
}, true)

window.addEventListener('unhandledrejection', (event) => {
  void trackAppError(event.reason || new Error('Unhandled promise rejection'), {
    metadata: {
      source: 'window-unhandledrejection',
    },
  })
})

router.onError((error, to) => {
  void trackAppError(error, {
    metadata: {
      source: 'router-onError',
      routePath: to.fullPath,
    },
  })
})

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const normalizedPath = axios.isAxiosError(error) ? normalizeRequestPath(error.config?.url) : ''

    if (shouldTrackAxiosError(error)) {
      void trackApiError(error, {
        metadata: {
          source: 'axios-response',
          requestPath: normalizedPath,
          requestMethod: error.config?.method?.toUpperCase(),
          status: error.response?.status,
          code: error.code,
          responseData: error.response?.data,
        },
      })
    }

    if (axios.isAxiosError(error) && error.response?.data?.code === 'LICENSE_EXPIRED') {
      const auth = useAuthStore(pinia)
      await auth.handleLicenseExpired(error.response.data.licenseExpiresAt)

      if (router.currentRoute.value.path !== '/license-expired') {
        await router.push(auth.getLicenseExpiredRouteLocation())
      }
    }

    return Promise.reject(error)
  },
)

app.mount('#app')
