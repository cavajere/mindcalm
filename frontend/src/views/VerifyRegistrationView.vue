<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = computed(() => (route.query.token as string) || '')
const loadingDetails = ref(true)
const loading = ref(false)
const error = ref('')
const success = ref('')
const details = ref<{
  email: string
  firstName: string
  lastName: string
  verificationExpiresAt: string
  code: string
  licenseDurationDays: number
} | null>(null)

function formatDuration(days: number) {
  if (days % 365 === 0) {
    const years = days / 365
    return years === 1 ? '1 anno' : `${years} anni`
  }

  if (days % 30 === 0) {
    const months = days / 30
    return months === 1 ? '1 mese' : `${months} mesi`
  }

  return `${days} giorni`
}

async function fetchDetails() {
  if (!token.value) {
    error.value = 'Token verifica mancante'
    loadingDetails.value = false
    return
  }

  try {
    const { data } = await axios.get(`/api/v1/auth/registration-verification-details?token=${encodeURIComponent(token.value)}`)
    details.value = data
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Registrazione non valida'
  } finally {
    loadingDetails.value = false
  }
}

async function handleVerify() {
  error.value = ''
  success.value = ''

  if (!token.value) {
    error.value = 'Token verifica mancante'
    return
  }

  loading.value = true

  try {
    await axios.post('/api/v1/auth/verify-registration', {
      token: token.value,
    })
    await auth.fetchMe()
    success.value = 'Registrazione confermata. Accesso in corso.'
    window.setTimeout(() => {
      router.push('/')
    }, 600)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Conferma registrazione non riuscita'
  } finally {
    loading.value = false
  }
}

onMounted(fetchDetails)
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-text-primary">Conferma registrazione</h1>
        <p class="text-text-secondary text-sm mt-1">Ultimo passaggio per attivare il tuo account</p>
      </div>

      <div class="card p-6 space-y-4">
        <div v-if="success" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
          {{ success }}
        </div>
        <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
          {{ error }}
        </div>

        <div v-if="loadingDetails" class="text-sm text-text-secondary">
          Verifica registrazione...
        </div>

        <template v-else-if="details">
          <div class="bg-primary/5 rounded-lg px-4 py-3 text-sm">
            <p class="font-medium text-text-primary">{{ details.firstName }} {{ details.lastName }}</p>
            <p class="text-text-secondary">{{ details.email }}</p>
            <p class="text-text-secondary mt-1">
              Codice {{ details.code }} · Licenza {{ formatDuration(details.licenseDurationDays) }}
            </p>
            <p class="text-text-secondary mt-1">
              Link valido fino al {{ new Date(details.verificationExpiresAt).toLocaleString('it-IT') }}
            </p>
          </div>

          <button type="button" :disabled="loading" class="btn-primary w-full" @click="handleVerify">
            {{ loading ? 'Conferma...' : 'Conferma registrazione' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
