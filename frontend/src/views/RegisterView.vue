<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import AppStatusMessage from '../components/AppStatusMessage.vue'
import { getApiErrorMessage, getApiSuccessMessage } from '../utils/apiMessages'

const PHONE_REGEX = /^\\+?[0-9\\s().-]{7,20}$/
const INVITE_CODE_REGEX = /^[A-NP-Z1-9]{7}$/

const loading = ref(false)
const validatingCode = ref(false)
const error = ref('')
const success = ref('')
const inviteCodeError = ref('')
const inviteCodeDetails = ref<{ licenseDurationDays: number } | null>(null)
const legalLoading = ref(false)
const legalDocuments = ref<{
  privacy: { versionId: string; title: string; url: string } | null
  terms: { versionId: string; title: string; url: string; requiredForRegistration: boolean } | null
} | null>(null)
const communicationConsentLoading = ref(false)
const communicationConsentError = ref('')
const communicationConsentFormulas = ref<Array<{
  id: string
  code: string
  required: boolean
  title: string
  text: string
}>>([])

// Registration type toggle
const registrationType = ref<'free' | 'premium'>('free')

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  code: '',
  acceptTerms: false,
  communicationConsents: {} as Record<string, 'YES' | 'NO' | null>,
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
const privacyDocument = computed(() => legalDocuments.value?.privacy ?? null)
const termsDocument = computed(() => legalDocuments.value?.terms ?? null)
const hasCommunicationConsents = computed(() => communicationConsentFormulas.value.length > 0)
const isPremium = computed(() => registrationType.value === 'premium')

function isPhoneValid(phone: string) {
  const normalized = phone.trim()
  const digitsOnly = normalized.replace(/\\D/g, '')
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

async function fetchLegalDocuments() {
  legalLoading.value = true

  try {
    const { data } = await axios.get('/public-api/legal-documents')
    legalDocuments.value = data
  } catch {
    legalDocuments.value = null
  } finally {
    legalLoading.value = false
  }
}

async function fetchCommunicationConsentFormulas() {
  communicationConsentLoading.value = true
  communicationConsentError.value = ''

  try {
    const { data } = await axios.get('/public-api/consent-formulas')
    const formulas = Array.isArray(data?.consentFormulas) ? data.consentFormulas : []

    communicationConsentFormulas.value = formulas.map((formula: any) => {
      return {
        id: String(formula.id),
        code: String(formula.code || ''),
        required: Boolean(formula.required),
        title: String(formula.currentVersion?.title || formula.code || 'Consenso comunicazione'),
        text: String(formula.currentVersion?.text || ''),
      }
    })

    form.value.communicationConsents = communicationConsentFormulas.value.reduce<Record<string, 'YES' | 'NO' | null>>((acc, formula) => {
      acc[formula.id] = form.value.communicationConsents[formula.id] ?? null
      return acc
    }, {})
  } catch (apiError) {
    communicationConsentFormulas.value = []
    communicationConsentError.value = axios.isAxiosError(apiError) && apiError.response?.status === 404
      ? ''
      : 'Consensi comunicazione non disponibili al momento'
  } finally {
    communicationConsentLoading.value = false
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

  if (termsDocument.value?.requiredForRegistration && !form.value.acceptTerms) {
    error.value = 'Devi accettare i termini e le condizioni per continuare'
    return
  }

  if (hasCommunicationConsents.value) {
    const missingChoice = communicationConsentFormulas.value.find((formula) => !form.value.communicationConsents[formula.id])
    if (missingChoice) {
      error.value = 'Seleziona una preferenza per ogni consenso comunicazione'
      return
    }
  }

  // Validate invite code for premium registration
  if (isPremium.value) {
    const isCodeValid = await lookupInviteCode()
    if (!isCodeValid) {
      error.value = inviteCodeError.value || 'Codice invito non valido'
      return
    }
  }

  loading.value = true

  try {
    const endpoint = isPremium.value ? '/api/auth/register-with-invite-code' : '/api/auth/register-free'
    
    const payload = {
      email: form.value.email.trim(),
      firstName: form.value.firstName.trim(),
      lastName: form.value.lastName.trim(),
      phone: form.value.phone.trim(),
      password: form.value.password,
      acceptTerms: form.value.acceptTerms,
      termsVersionId: termsDocument.value?.versionId,
      consents: communicationConsentFormulas.value.map((formula) => ({
        formulaId: formula.id,
        value: form.value.communicationConsents[formula.id],
      })),
    }

    if (isPremium.value) {
      ;(payload as any).code = normalizedCode.value
    }

    const { data } = await axios.post(endpoint, payload)

    success.value = getApiSuccessMessage(data, 'Controlla la tua email per completare la registrazione')
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Registrazione non riuscita')
  } finally {
    loading.value = false
  }
}

// Clear invite code related fields when switching to free
watch(isPremium, (newValue) => {
  if (!newValue) {
    form.value.code = ''
    inviteCodeError.value = ''
    inviteCodeDetails.value = null
  }
})

onMounted(() => {
  fetchLegalDocuments()
  fetchCommunicationConsentFormulas()
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4 py-8">
    <div class="w-full max-w-lg">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-text-primary">Registrazione</h1>
        <p class="text-text-secondary text-sm mt-1">Crea il tuo account su MindCalm</p>
      </div>

      <form @submit.prevent="handleSubmit" class="card p-6 space-y-6" autocomplete="on">
        <AppStatusMessage v-if="success" :message="success" variant="success" />
        <AppStatusMessage v-if="error" :message="error" variant="error" />

        <!-- Registration Type Toggle -->
        <div class="space-y-3">
          <label class="block text-sm font-medium text-text-primary">Tipo di registrazione</label>
          <div class="flex bg-muted rounded-xl p-1">
            <button
              type="button"
              class="flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all"
              :class="!isPremium ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'"
              @click="registrationType = 'free'"
            >
              <div class="flex items-center justify-center gap-2">
                <span>Gratuita</span>
                <span class="inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-text-secondary">
                  Free
                </span>
              </div>
            </button>
            <button
              type="button"
              class="flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all"
              :class="isPremium ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'"
              @click="registrationType = 'premium'"
            >
              <div class="flex items-center justify-center gap-2">
                <span>Con Codice</span>
                <span class="inline-flex items-center rounded-full bg-secondary/10 px-2 py-1 text-[10px] font-medium text-secondary">
                  Premium
                </span>
              </div>
            </button>
          </div>
          <p class="text-xs text-text-secondary">
            {{ isPremium 
              ? 'Hai un codice di attivazione? Accedi a tutti i contenuti audio e riservati.' 
              : 'Accedi ai contenuti pubblici, notifiche e profilo personalizzato.' 
            }}
          </p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">Nome</label>
            <input v-model="form.firstName" name="firstName" type="text" autocomplete="given-name" required class="w-full px-3 py-3 rounded-xl border border-ui-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Mario" />
          </div>

          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">Cognome</label>
            <input v-model="form.lastName" name="lastName" type="text" autocomplete="family-name" required class="w-full px-3 py-3 rounded-xl border border-ui-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Rossi" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1">Email</label>
          <input v-model="form.email" name="email" type="email" autocomplete="email" required class="w-full px-3 py-3 rounded-xl border border-ui-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="utente@example.com" />
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1">Telefono</label>
          <input v-model="form.phone" name="phone" type="tel" autocomplete="tel" required class="w-full px-3 py-3 rounded-xl border border-ui-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="+39 333 123 4567" />
        </div>

        <!-- Invite Code Field (only for premium) -->
        <div v-if="isPremium">
          <label class="block text-sm font-medium text-text-primary mb-1">Codice invito</label>
          <input
            :value="form.code"
            name="inviteCode"
            type="text"
            inputmode="text"
            autocomplete="off"
            required
            maxlength="7"
            class="w-full px-3 py-3 rounded-xl border border-ui-border bg-surface font-mono tracking-[0.35em] uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="G6K39C2"
            @input="onCodeInput"
            @blur="lookupInviteCode"
          />
          <p v-if="validatingCode" class="text-xs text-text-secondary mt-1">Verifica codice...</p>
          <p v-else-if="inviteCodeDetails" class="text-xs text-green-600 dark:text-green-400 mt-1">
            Codice valido. Licenza: {{ formatDuration(inviteCodeDetails.licenseDurationDays) }} dall'attivazione.
          </p>
          <p v-else-if="inviteCodeError" class="text-xs text-red-600 dark:text-red-400 mt-1">{{ inviteCodeError }}</p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">Password</label>
            <input v-model="form.password" name="password" type="password" minlength="8" autocomplete="new-password" required class="w-full px-3 py-3 rounded-xl border border-ui-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Minimo 8 caratteri" />
          </div>

          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">Conferma password</label>
            <input v-model="form.confirmPassword" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required class="w-full px-3 py-3 rounded-xl border border-ui-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Ripeti la password" />
          </div>
        </div>

        <!-- Legal Documents Section -->
        <div class="border-t border-ui-border/50 pt-6">
          <h3 class="text-sm font-semibold text-text-primary mb-3">Documenti legali</h3>
          <p class="text-sm text-text-secondary mb-4">
            Consulta sempre i documenti aggiornati prima di completare la registrazione.
          </p>

          <div class="flex flex-wrap gap-3 text-sm mb-4">
            <a v-if="privacyDocument" :href="privacyDocument.url" target="_blank" rel="noreferrer" class="text-primary hover:underline">
              {{ privacyDocument.title }}
            </a>
            <a v-if="termsDocument" :href="termsDocument.url" target="_blank" rel="noreferrer" class="text-primary hover:underline">
              {{ termsDocument.title }}
            </a>
            <span v-if="legalLoading" class="text-text-secondary">Caricamento documenti...</span>
          </div>

          <label v-if="termsDocument" class="flex items-start gap-3 text-sm text-text-primary">
            <input v-model="form.acceptTerms" type="checkbox" class="mt-1 h-4 w-4 rounded border-ui-border" />
            <span>
              Accetto i termini e le condizioni pubblicati.
            </span>
          </label>
        </div>

        <!-- Communication Consents Section -->
        <div v-if="communicationConsentLoading || hasCommunicationConsents || communicationConsentError" class="border-t border-ui-border/50 pt-6">
          <h3 class="text-sm font-semibold text-text-primary mb-3">Consensi comunicazione</h3>
          <p class="text-sm text-text-secondary mb-4">
            Indica se desideri ricevere comunicazioni informative e promozionali.
          </p>

          <p v-if="communicationConsentLoading" class="text-sm text-text-secondary">
            Caricamento consensi...
          </p>
          <p v-else-if="communicationConsentError" class="text-sm text-red-600 dark:text-red-400">
            {{ communicationConsentError }}
          </p>

          <div v-else class="space-y-6">
            <div
              v-for="formula in communicationConsentFormulas"
              :key="formula.id"
              class="pb-4 border-b border-ui-border/30 last:border-b-0 last:pb-0"
            >
              <div class="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h4 class="text-sm font-medium text-text-primary">{{ formula.title }}</h4>
                  <p v-if="formula.text" class="mt-1 text-sm text-text-secondary">{{ formula.text }}</p>
                </div>
                <span v-if="formula.required" class="rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200 whitespace-nowrap">
                  Obbligatorio
                </span>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="flex items-center gap-3 text-sm text-text-primary cursor-pointer">
                  <input
                    v-model="form.communicationConsents[formula.id]"
                    :name="`communication-consent-${formula.id}`"
                    type="radio"
                    value="YES"
                    class="h-4 w-4 border-ui-border text-primary focus:ring-primary"
                  />
                  <span>Sì, acconsento</span>
                </label>

                <label class="flex items-center gap-3 text-sm text-text-primary cursor-pointer">
                  <input
                    v-model="form.communicationConsents[formula.id]"
                    :name="`communication-consent-${formula.id}`"
                    type="radio"
                    value="NO"
                    class="h-4 w-4 border-ui-border text-primary focus:ring-primary"
                  />
                  <span>No, grazie</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" :disabled="loading || validatingCode || communicationConsentLoading" class="btn-primary w-full">
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