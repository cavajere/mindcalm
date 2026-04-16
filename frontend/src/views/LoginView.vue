<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { useNotificationStore } from '../stores/notificationStore'
import { getApiErrorMessage } from '../utils/apiMessages'

const auth = useAuthStore()
const router = useRouter()
const notifications = useNotificationStore()

const isDev = import.meta.env.DEV

const email = ref(isDev ? 'admin@mindcalm.com' : '')
const password = ref(isDev ? 'admin123!' : '')
const loading = ref(false)

async function handleLogin() {
  loading.value = true

  try {
    await auth.login(email.value, password.value)
    router.push('/')
  } catch (apiError) {
    if (auth.isLicenseExpired) {
      await router.push(auth.getLicenseExpiredRouteLocation())
      return
    }

    const errorMessage = getApiErrorMessage(apiError, 'Errore di connessione')
    notifications.showError(errorMessage)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4 py-8">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-semibold text-text-primary mb-2">Bentornato</h1>
        <p class="text-text-secondary">
          Accedi alla tua area personale per continuare il tuo percorso.
        </p>
      </div>

      <div v-if="isDev" class="rounded-xl bg-amber-100 dark:bg-amber-900 border border-amber-200 dark:border-amber-800 p-4 mb-6">
        <p class="text-xs font-semibold text-amber-700 dark:text-amber-200 uppercase tracking-wide mb-2">Dev credentials</p>
        <div class="space-y-1">
          <div class="text-sm font-mono text-amber-900 dark:text-amber-100">admin@mindcalm.com</div>
          <div class="text-sm font-mono text-amber-900 dark:text-amber-100">admin123!</div>
        </div>
      </div>

      <form @submit.prevent="handleLogin" class="card p-6 space-y-6">

          <div>
            <label class="block text-sm font-medium text-text-primary mb-2">Email</label>
            <input v-model="email" type="email" required class="w-full px-4 py-3 rounded-xl border border-ui-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-primary placeholder-text-secondary" placeholder="utente@example.com" />
          </div>

          <div>
            <label class="block text-sm font-medium text-text-primary mb-2">Password</label>
            <input v-model="password" type="password" required class="w-full px-4 py-3 rounded-xl border border-ui-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-text-primary placeholder-text-secondary" placeholder="Password" />
          </div>

          <div class="flex items-center justify-between">
            <router-link to="/forgot-password" class="text-sm text-primary hover:underline">
              Password dimenticata?
            </router-link>
          </div>

          <button type="submit" :disabled="loading" class="btn-primary w-full">
            {{ loading ? 'Accesso in corso...' : 'Accedi alla tua area' }}
          </button>

      </form>
    </div>
  </div>
</template>