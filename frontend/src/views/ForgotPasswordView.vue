<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'
import AppStatusMessage from '../components/AppStatusMessage.vue'
import { getApiErrorMessage, getApiSuccessMessage } from '../utils/apiMessages'

const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

async function handleSubmit() {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    const { data } = await axios.post('/api/auth/forgot-password', {
      email: email.value,
    })
    success.value = getApiSuccessMessage(data, 'Se l’email esiste, riceverai un link per reimpostare la password')
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Invio email non riuscito')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-text-primary">Password dimenticata</h1>
        <p class="text-text-secondary text-sm mt-1">Ricevi un link per reimpostare la password</p>
      </div>

      <form @submit.prevent="handleSubmit" class="card p-6 space-y-4">
        <AppStatusMessage v-if="success" :message="success" variant="success" />
        <AppStatusMessage v-if="error" :message="error" variant="error" />

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1">Email</label>
          <input v-model="email" type="email" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="utente@example.com" />
        </div>

        <button type="submit" :disabled="loading" class="btn-primary w-full">
          {{ loading ? 'Invio...' : 'Invia link reset' }}
        </button>

        <router-link to="/login" class="block text-center text-sm text-primary hover:underline">
          Torna al login
        </router-link>
      </form>
    </div>
  </div>
</template>
