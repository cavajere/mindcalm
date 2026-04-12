<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import AppStatusMessage from '../components/AppStatusMessage.vue'
import { useAuthStore } from '../stores/authStore'
import { getApiErrorMessage, getApiSuccessMessage } from '../utils/apiMessages'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const loadingInvite = ref(true)
const error = ref('')
const success = ref('')
const invite = ref<{ name: string; email: string; inviteExpiresAt: string } | null>(null)
const token = computed(() => route.query.token as string || '')

async function fetchInviteDetails() {
  if (!token.value) {
    error.value = 'Token invito mancante'
    loadingInvite.value = false
    return
  }

  try {
    const { data } = await axios.get(`/api/auth/invite-details?token=${encodeURIComponent(token.value)}`)
    invite.value = data
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Invito non valido')
  } finally {
    loadingInvite.value = false
  }
}

async function handleSubmit() {
  error.value = ''
  success.value = ''

  if (!token.value) {
    error.value = 'Token invito mancante'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Le password non coincidono'
    return
  }

  loading.value = true

  try {
    const { data } = await axios.post('/api/auth/accept-invite', {
      token: token.value,
      password: password.value,
    })
    await auth.fetchMe()
    success.value = getApiSuccessMessage(data, 'Invito accettato. Accesso in corso.')
    setTimeout(() => router.push('/'), 500)
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Accettazione invito non riuscita')
  } finally {
    loading.value = false
  }
}

onMounted(fetchInviteDetails)
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-text-primary">Attiva il tuo account</h1>
        <p class="text-text-secondary text-sm mt-1">Imposta la password per iniziare a usare MindCalm</p>
      </div>

      <form @submit.prevent="handleSubmit" class="card p-6 space-y-4">
        <AppStatusMessage v-if="success" :message="success" variant="success" />
        <AppStatusMessage v-if="error" :message="error" variant="error" />

        <div v-if="loadingInvite" class="text-sm text-text-secondary">
          Verifica invito...
        </div>

        <template v-else-if="invite">
          <div class="bg-primary/5 rounded-lg px-4 py-3 text-sm">
            <p class="font-medium text-text-primary">{{ invite.name }}</p>
            <p class="text-text-secondary">{{ invite.email }}</p>
            <p class="text-text-secondary mt-1">
              Invito valido fino al {{ new Date(invite.inviteExpiresAt).toLocaleString('it-IT') }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">Nuova password</label>
            <input v-model="password" type="password" minlength="8" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Minimo 8 caratteri" />
          </div>

          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">Conferma password</label>
            <input v-model="confirmPassword" type="password" minlength="8" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Ripeti la password" />
          </div>

          <button type="submit" :disabled="loading" class="btn-primary w-full">
            {{ loading ? 'Attivazione...' : 'Attiva account' }}
          </button>
        </template>
      </form>
    </div>
  </div>
</template>
