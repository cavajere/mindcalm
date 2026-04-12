<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const SMTP_MASKED_PASSWORD = '••••••••'

interface AltavoloTenantSmtpConfigFile {
  exportedAt: string
  source: 'tenant'
  config: {
    host: string
    port?: number | null
    secure?: boolean | null
    authUser?: string | null
    authPass?: string | null
    fromAddress?: string | null
  }
}

const auth = useAuthStore()
const loading = ref(false)
const testing = ref(false)
const success = ref('')
const error = ref('')
const importFileRef = ref<HTMLInputElement | null>(null)
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
const canExport = computed(() => Boolean(form.value.host.trim()))

async function fetchSettings() {
  success.value = ''
  error.value = ''
  const { data } = await axios.get('/api/admin/settings/smtp')
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
    const { data } = await axios.put('/api/admin/settings/smtp', {
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

function exportSettings() {
  if (!canExport.value) {
    error.value = 'Nessuna configurazione SMTP da esportare'
    success.value = ''
    return
  }

  const payload: AltavoloTenantSmtpConfigFile = {
    exportedAt: new Date().toISOString(),
    source: 'tenant',
    config: {
      host: form.value.host,
      port: form.value.port,
      secure: form.value.secure,
      authUser: form.value.username || null,
      authPass: form.value.hasPassword ? SMTP_MASKED_PASSWORD : null,
      fromAddress: form.value.fromEmail || null,
    },
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'smtp-config.json'
  link.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  importFileRef.value?.click()
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  success.value = ''
  error.value = ''

  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as Partial<AltavoloTenantSmtpConfigFile>
    const cfg = parsed.config

    if (!cfg?.host) {
      throw new Error('File SMTP non valido')
    }

    const fromEmail = cfg.fromAddress || form.value.fromEmail
    if (!fromEmail) {
      throw new Error('Il file SMTP non contiene un indirizzo mittente valido')
    }

    const payload: {
      host: string
      port: number
      secure: boolean
      username: string | null
      password?: string | null
      fromEmail: string
      fromName: string | null
    } = {
      host: cfg.host,
      port: typeof cfg.port === 'number' ? cfg.port : 587,
      secure: Boolean(cfg.secure),
      username: cfg.authUser || null,
      fromEmail,
      fromName: form.value.fromName || null,
    }

    if (cfg.authPass && cfg.authPass !== SMTP_MASKED_PASSWORD) {
      payload.password = cfg.authPass
    }

    const { data } = await axios.put('/api/admin/settings/smtp', payload)

    form.value.host = data.host
    form.value.port = data.port
    form.value.secure = data.secure
    form.value.username = data.username || ''
    form.value.password = ''
    form.value.fromEmail = data.fromEmail
    form.value.fromName = data.fromName || form.value.fromName || ''
    form.value.hasPassword = data.hasPassword

    success.value = 'Configurazione SMTP importata'
  } catch (e: any) {
    if (e instanceof SyntaxError) {
      error.value = 'File SMTP non valido'
    } else {
      error.value = e.response?.data?.error || e.message || 'Import configurazione SMTP fallito'
    }
  } finally {
    input.value = ''
  }
}

async function sendTestEmail() {
  success.value = ''
  error.value = ''
  testing.value = true

  try {
    const { data } = await axios.post('/api/admin/settings/smtp/test', {
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
      <input
        ref="importFileRef"
        type="file"
        accept=".json,application/json"
        class="hidden"
        @change="handleImportFile"
      />

      <div v-if="success" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
        {{ success }}
      </div>
      <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
        {{ error }}
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button type="button" :disabled="!canExport" class="btn-secondary" @click="exportSettings">
          Export configurazione
        </button>
        <button type="button" class="btn-secondary" @click="triggerImport">
          Import configurazione
        </button>
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
