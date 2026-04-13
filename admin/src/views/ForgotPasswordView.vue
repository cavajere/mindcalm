<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'

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

    success.value = data.message
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Invio email non riuscito'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-text-primary">Password dimenticata</h1>
        <p class="text-text-secondary text-sm mt-1">Ricevi un link per reimpostare la password</p>
      </div>

      <form @submit.prevent="handleSubmit" class="card space-y-4">
        <div v-if="success" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
          {{ success }}
        </div>
        <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
          {{ error }}
        </div>

        <div>
          <label class="label">Email</label>
          <input v-model="email" type="email" required class="input-field" placeholder="admin@mindcalm.com" />
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
