<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { getApiErrorMessage } from '../utils/apiMessages'

const auth = useAuthStore()
const router = useRouter()

const isDev = import.meta.env.DEV

const email = ref(isDev ? 'admin@mindcalm.com' : '')
const password = ref(isDev ? 'admin123!' : '')
const loading = ref(false)
const errorMessage = ref('')

watch([email, password], () => {
  if (errorMessage.value) errorMessage.value = ''
})

async function handleLogin() {
  errorMessage.value = ''
  loading.value = true

  try {
    await auth.login(email.value, password.value)
    router.push('/')
  } catch (apiError) {
    if (auth.isLicenseExpired) {
      await router.push(auth.getLicenseExpiredRouteLocation())
      return
    }

    errorMessage.value = getApiErrorMessage(apiError)
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

      <form @submit.prevent="handleLogin" class="card p-6 space-y-6" novalidate>

          <div
            v-if="errorMessage"
            role="alert"
            aria-live="polite"
            class="flex gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-200"
          >
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-8-3a1 1 0 00-1 1v3a1 1 0 002 0V8a1 1 0 00-1-1zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
            </svg>
            <span>{{ errorMessage }}</span>
          </div>

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
