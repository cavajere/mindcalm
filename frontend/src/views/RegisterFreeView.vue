<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import AppStatusMessage from '../components/AppStatusMessage.vue'
import { getApiErrorMessage, getApiSuccessMessage } from '../utils/apiMessages'

const PHONE_REGEX = /^\+?[0-9\s().-]{7,20}$/

const loading = ref(false)
const error = ref('')
const success = ref('')
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

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
  communicationConsents: {} as Record<string, 'YES' | 'NO' | null>,
})

const isPhoneValid = computed(() => {
  return !form.value.phone || PHONE_REGEX.test(form.value.phone)
})

const isPasswordValid = computed(() => {
  return form.value.password.length >= 8
})

const isConfirmPasswordValid = computed(() => {
  return form.value.password === form.value.confirmPassword
})

const canSubmit = computed(() => {
  const basicRequirements = 
    form.value.firstName &&
    form.value.lastName &&
    form.value.email &&
    isPhoneValid.value &&
    isPasswordValid.value &&
    isConfirmPasswordValid.value &&
    (!legalDocuments.value?.terms?.requiredForRegistration || form.value.acceptTerms)

  const communicationConsentsValid = communicationConsentFormulas.value.every(formula => {
    const consent = form.value.communicationConsents[formula.id]
    return !formula.required || consent === 'YES'
  })

  return basicRequirements && communicationConsentsValid
})

async function register() {
  if (!canSubmit.value || loading.value) return

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const consents = communicationConsentFormulas.value.map(formula => ({
      formulaId: formula.id,
      value: form.value.communicationConsents[formula.id] || 'NO'
    }))

    const payload = {
      firstName: form.value.firstName,
      lastName: form.value.lastName,
      email: form.value.email,
      phone: form.value.phone || undefined,
      password: form.value.password,
      acceptTerms: form.value.acceptTerms,
      termsVersionId: legalDocuments.value?.terms?.versionId,
      consents,
      verificationBaseUrl: location.origin,
    }

    const { data } = await axios.post('/api/auth/register-free', payload)
    success.value = getApiSuccessMessage(data, 'Controlla la tua email per completare la registrazione')
    
    // Reset form
    form.value = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
      communicationConsents: {},
    }
  } catch (e: unknown) {
    error.value = getApiErrorMessage(e, 'Errore durante la registrazione')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // Load legal documents
  legalLoading.value = true
  try {
    const { data } = await axios.get('/api/public/legal-documents')
    legalDocuments.value = data
  } catch (e: unknown) {
    console.error('Failed to load legal documents:', e)
  } finally {
    legalLoading.value = false
  }

  // Load communication consent formulas
  communicationConsentLoading.value = true
  try {
    const { data } = await axios.get('/api/public/communication-consents')
    communicationConsentFormulas.value = data.formulas || []
    
    // Initialize consent values
    const initialConsents: Record<string, 'YES' | 'NO' | null> = {}
    communicationConsentFormulas.value.forEach(formula => {
      initialConsents[formula.id] = null
    })
    form.value.communicationConsents = initialConsents
  } catch (e: unknown) {
    communicationConsentError.value = getApiErrorMessage(e, 'Errore nel caricamento delle preferenze di comunicazione')
  } finally {
    communicationConsentLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <router-link to="/register" class="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Torna indietro
        </router-link>
        <h1 class="text-3xl font-bold text-text-primary mb-2">Registrazione Gratuita</h1>
        <p class="text-text-secondary">Crea il tuo account gratuito su MindCalm</p>
      </div>

      <div class="card">
        <form @submit.prevent="register" class="p-6 space-y-4">
          <AppStatusMessage v-if="error" type="error" :message="error" />
          <AppStatusMessage v-if="success" type="success" :message="success" />

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Nome *</label>
              <input 
                v-model="form.firstName" 
                type="text" 
                required 
                class="input-field"
                placeholder="Il tuo nome"
              />
            </div>
            <div>
              <label class="label">Cognome *</label>
              <input 
                v-model="form.lastName" 
                type="text" 
                required 
                class="input-field"
                placeholder="Il tuo cognome"
              />
            </div>
          </div>

          <div>
            <label class="label">Email *</label>
            <input 
              v-model="form.email" 
              type="email" 
              required 
              class="input-field"
              placeholder="la-tua-email@esempio.com"
            />
          </div>

          <div>
            <label class="label">Telefono</label>
            <input 
              v-model="form.phone" 
              type="tel" 
              class="input-field"
              :class="{ 'border-red-300': form.phone && !isPhoneValid }"
              placeholder="+39 123 456 7890"
            />
            <p v-if="form.phone && !isPhoneValid" class="text-red-500 text-xs mt-1">
              Formato telefono non valido
            </p>
          </div>

          <div>
            <label class="label">Password *</label>
            <input 
              v-model="form.password" 
              type="password" 
              required 
              class="input-field"
              :class="{ 'border-red-300': form.password && !isPasswordValid }"
              placeholder="Minimo 8 caratteri"
            />
            <p v-if="form.password && !isPasswordValid" class="text-red-500 text-xs mt-1">
              La password deve essere di almeno 8 caratteri
            </p>
          </div>

          <div>
            <label class="label">Conferma Password *</label>
            <input 
              v-model="form.confirmPassword" 
              type="password" 
              required 
              class="input-field"
              :class="{ 'border-red-300': form.confirmPassword && !isConfirmPasswordValid }"
              placeholder="Ripeti la password"
            />
            <p v-if="form.confirmPassword && !isConfirmPasswordValid" class="text-red-500 text-xs mt-1">
              Le password non coincidono
            </p>
          </div>

          <!-- Terms acceptance -->
          <div v-if="legalDocuments?.terms?.requiredForRegistration" class="space-y-3">
            <label class="flex items-start gap-3 cursor-pointer">
              <input 
                v-model="form.acceptTerms" 
                type="checkbox" 
                class="mt-1 accent-primary"
                required
              />
              <span class="text-sm text-text-primary">
                Accetto i 
                <a 
                  :href="legalDocuments.terms.url" 
                  target="_blank" 
                  class="text-primary hover:underline font-medium"
                >
                  {{ legalDocuments.terms.title }}
                </a>
              </span>
            </label>
          </div>

          <!-- Communication Consents -->
          <div v-if="communicationConsentFormulas.length > 0" class="space-y-4">
            <h3 class="font-semibold text-text-primary">Preferenze di Comunicazione</h3>
            <div v-for="formula in communicationConsentFormulas" :key="formula.id" class="space-y-2">
              <h4 class="text-sm font-medium text-text-primary">
                {{ formula.title }}
                <span v-if="formula.required" class="text-red-500">*</span>
              </h4>
              <p class="text-sm text-text-secondary">{{ formula.text }}</p>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input 
                    v-model="form.communicationConsents[formula.id]" 
                    type="radio" 
                    :value="'YES'" 
                    class="accent-primary"
                    :required="formula.required"
                  />
                  <span class="text-sm">Sì, acconsento</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input 
                    v-model="form.communicationConsents[formula.id]" 
                    type="radio" 
                    :value="'NO'" 
                    class="accent-primary"
                    :required="formula.required"
                  />
                  <span class="text-sm">No, grazie</span>
                </label>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            :disabled="!canSubmit || loading"
            class="w-full bg-primary text-white py-3 rounded-2xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Registrazione in corso...</span>
            <span v-else>Completa Registrazione Gratuita</span>
          </button>
        </form>
      </div>

      <div class="text-center mt-6 text-sm text-text-secondary">
        Hai già un account? 
        <router-link to="/login" class="text-primary hover:underline font-medium">Accedi</router-link>
      </div>
    </div>
  </div>
</template>