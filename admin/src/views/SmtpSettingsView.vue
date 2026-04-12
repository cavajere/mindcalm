<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const loading = ref(false)
const testing = ref(false)
const success = ref('')
const error = ref('')
const form = ref({
  host: '',
  port: 587,
  secure: false,
  username: '',
  password: '',
  fromEmail: '',
  fromName: '',
  hasPassword: false,
})

async function fetchSettings() {
  const { data } = await axios.get('/api/v1/admin/settings/smtp')
  if (!data) return

  form.value.host = data.host
  form.value.port = data.port
  form.value.secure = data.secure
  form.value.username = data.username || ''
  form.value.fromEmail = data.fromEmail
  form.value.fromName = data.fromName || ''
  form.value.hasPassword = data.hasPassword
}

async function saveSettings() {
  success.value = ''
  error.value = ''
  loading.value = true

  try {
    const { data } = await axios.put('/api/v1/admin/settings/smtp', {
      host: form.value.host,
      port: form.value.port,
      secure: form.value.secure,
      username: form.value.username || null,
      password: form.value.password || null,
      fromEmail: form.value.fromEmail,
      fromName: form.value.fromName || null,
    })

    form.value.hasPassword = data.hasPassword
    form.value.password = ''
    success.value = 'Configurazione SMTP salvata'
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore di salvataggio'
  } finally {
    loading.value = false
  }
}

async function sendTestEmail() {
  success.value = ''
  error.value = ''
  testing.value = true

  try {
    const { data } = await axios.post('/api/v1/admin/settings/smtp/test', {
      email: auth.user?.email,
    })
    success.value = data.message
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Invio email di test fallito'
  } finally {
    testing.value = false
  }
}

onMounted(fetchSettings)
</script>

<template>
  <div class="mx-auto w-full max-w-3xl">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-text-primary">SMTP</h1>
      <p class="text-sm text-text-secondary mt-1">Configura il server email usato per forgot/reset password</p>
    </div>

    <form @submit.prevent="saveSettings" class="card space-y-4">
      <div v-if="success" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
        {{ success }}
      </div>
      <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
        {{ error }}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="label">Host SMTP</label>
          <input v-model="form.host" type="text" required class="input-field" placeholder="smtp.example.com" />
        </div>
        <div>
          <label class="label">Porta</label>
          <input v-model.number="form.port" type="number" min="1" max="65535" required class="input-field" />
        </div>
      </div>

      <label class="flex items-center gap-3 text-sm text-text-primary">
        <input v-model="form.secure" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary/30" />
        Connessione sicura (SSL/TLS)
      </label>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="label">Username SMTP</label>
          <input v-model="form.username" type="text" class="input-field" placeholder="utente smtp" />
        </div>
        <div>
          <label class="label">Password SMTP</label>
          <input v-model="form.password" type="password" class="input-field" :placeholder="form.hasPassword ? 'Lascia vuoto per mantenerla' : 'Password SMTP'" />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="label">Email mittente</label>
          <input v-model="form.fromEmail" type="email" required class="input-field" placeholder="no-reply@example.com" />
        </div>
        <div>
          <label class="label">Nome mittente</label>
          <input v-model="form.fromName" type="text" class="input-field" placeholder="MindCalm" />
        </div>
      </div>

      <div class="flex items-center gap-3 pt-2">
        <button type="submit" :disabled="loading" class="btn-primary">
          {{ loading ? 'Salvataggio...' : 'Salva configurazione' }}
        </button>
        <button type="button" :disabled="testing" class="btn-secondary" @click="sendTestEmail">
          {{ testing ? 'Invio test...' : 'Invia email di test' }}
        </button>
      </div>
    </form>
  </div>
</template>
