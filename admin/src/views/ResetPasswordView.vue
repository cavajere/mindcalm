<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')
const token = computed(() => route.query.token as string || '')

async function handleSubmit() {
  error.value = ''
  success.value = ''

  if (!token.value) {
    error.value = 'Token reset mancante'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Le password non coincidono'
    return
  }

  loading.value = true

  try {
    await axios.post('/api/v1/auth/reset-password', {
      token: token.value,
      password: password.value,
    })

    success.value = 'Password aggiornata. Verrai reindirizzato al login.'
    setTimeout(() => router.push('/login'), 1200)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Reset password non riuscito'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-text-primary">Reimposta password</h1>
        <p class="text-text-secondary text-sm mt-1">Inserisci una nuova password per il tuo account</p>
      </div>

      <form @submit.prevent="handleSubmit" class="card space-y-4">
        <div v-if="success" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
          {{ success }}
        </div>
        <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
          {{ error }}
        </div>

        <div>
          <label class="label">Nuova password</label>
          <input v-model="password" type="password" minlength="8" required class="input-field" placeholder="Minimo 8 caratteri" />
        </div>

        <div>
          <label class="label">Conferma password</label>
          <input v-model="confirmPassword" type="password" minlength="8" required class="input-field" placeholder="Ripeti la password" />
        </div>

        <button type="submit" :disabled="loading" class="btn-primary w-full">
          {{ loading ? 'Aggiornamento...' : 'Aggiorna password' }}
        </button>
      </form>
    </div>
  </div>
</template>
