<script setup lang="ts">
import { computed, ref } from 'vue'
import axios from 'axios'
import AppStatusMessage from '../components/AppStatusMessage.vue'
import { getApiErrorMessage, getApiSuccessMessage } from '../utils/apiMessages'

const PHONE_REGEX = /^\+?[0-9\s().-]{7,20}$/
const INVITE_CODE_REGEX = /^[A-NP-Z1-9]{7}$/

const loading = ref(false)
const validatingCode = ref(false)
const error = ref('')
const success = ref('')
const inviteCodeError = ref('')
const inviteCodeDetails = ref<{ licenseDurationDays: number } | null>(null)

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  code: '',
})

function normalizeInviteCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z1-9]/g, '').replaceAll('O', '').replaceAll('0', '').slice(0, 7)
}

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

const normalizedCode = computed(() => normalizeInviteCode(form.value.code))

function isPhoneValid(phone: string) {
  const normalized = phone.trim()
  const digitsOnly = normalized.replace(/\D/g, '')
  return PHONE_REGEX.test(normalized) && digitsOnly.length >= 7 && digitsOnly.length <= 15
}

function handleCodeInput(value: string) {
  form.value.code = normalizeInviteCode(value)
  inviteCodeError.value = ''
  inviteCodeDetails.value = null
}

function onCodeInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  handleCodeInput(target?.value || '')
}

async function lookupInviteCode() {
  inviteCodeError.value = ''
  inviteCodeDetails.value = null

  if (!normalizedCode.value) return true

  if (!INVITE_CODE_REGEX.test(normalizedCode.value)) {
    inviteCodeError.value = 'Codice invito non valido'
    return false
  }

  validatingCode.value = true

  try {
    const { data } = await axios.post('/api/auth/validate-invite-code', {
      code: normalizedCode.value,
    })
    inviteCodeDetails.value = {
      licenseDurationDays: data.licenseDurationDays,
    }
    return true
  } catch (error) {
    inviteCodeError.value = getApiErrorMessage(error, 'Codice invito non valido')
    return false
  } finally {
    validatingCode.value = false
  }
}

async function handleSubmit() {
  error.value = ''
  success.value = ''

  if (form.value.password !== form.value.confirmPassword) {
    error.value = 'Le password non coincidono'
    return
  }

  if (!isPhoneValid(form.value.phone)) {
    error.value = 'Numero di telefono non valido'
    return
  }

  const isCodeValid = await lookupInviteCode()
  if (!isCodeValid) {
    error.value = inviteCodeError.value || 'Codice invito non valido'
    return
  }

  loading.value = true

  try {
    const { data } = await axios.post('/api/auth/register-with-invite-code', {
      code: normalizedCode.value,
      email: form.value.email.trim(),
      firstName: form.value.firstName.trim(),
      lastName: form.value.lastName.trim(),
      phone: form.value.phone.trim(),
      password: form.value.password,
      verificationBaseUrl: window.location.origin,
    })

    success.value = getApiSuccessMessage(data, 'Controlla la tua email per completare la registrazione')
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Registrazione non riuscita')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4 py-8">
    <div class="w-full max-w-lg">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-text-primary">Registrati a MindCalm</h1>
        <p class="text-text-secondary text-sm mt-1">Inserisci il tuo codice invito e conferma la tua email</p>
      </div>

      <form @submit.prevent="handleSubmit" class="card p-6 space-y-4">
        <AppStatusMessage v-if="success" :message="success" variant="success" />
        <AppStatusMessage v-if="error" :message="error" variant="error" />

        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">Nome</label>
            <input v-model="form.firstName" type="text" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Mario" />
          </div>

          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">Cognome</label>
            <input v-model="form.lastName" type="text" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Rossi" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1">Email</label>
          <input v-model="form.email" type="email" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="utente@example.com" />
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1">Telefono</label>
          <input v-model="form.phone" type="tel" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="+39 333 123 4567" />
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1">Codice invito</label>
          <input
            :value="form.code"
            type="text"
            inputmode="text"
            autocomplete="off"
            required
            maxlength="7"
            class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface font-mono tracking-[0.35em] uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="G6K39C2"
            @input="onCodeInput"
            @blur="lookupInviteCode"
          />
          <p v-if="validatingCode" class="text-xs text-text-secondary mt-1">Verifica codice...</p>
          <p v-else-if="inviteCodeDetails" class="text-xs text-green-700 mt-1">
            Codice valido. Licenza: {{ formatDuration(inviteCodeDetails.licenseDurationDays) }} dall’attivazione.
          </p>
          <p v-else-if="inviteCodeError" class="text-xs text-red-600 mt-1">{{ inviteCodeError }}</p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">Password</label>
            <input v-model="form.password" type="password" minlength="8" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Minimo 8 caratteri" />
          </div>

          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">Conferma password</label>
            <input v-model="form.confirmPassword" type="password" minlength="8" required class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Ripeti la password" />
          </div>
        </div>

        <button type="submit" :disabled="loading || validatingCode" class="btn-primary w-full">
          {{ loading ? 'Registrazione...' : 'Registrati' }}
        </button>

        <div class="text-center text-sm">
          <router-link to="/login" class="text-primary hover:underline">
            Hai già un account? Accedi
          </router-link>
        </div>
      </form>
    </div>
  </div>
</template>
