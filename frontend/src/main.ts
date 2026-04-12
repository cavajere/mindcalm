import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/authStore'
import './assets/styles/main.css'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
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
