<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import AppStatusMessage from '../components/AppStatusMessage.vue'
import { getApiErrorMessage, getApiSuccessMessage } from '../utils/apiMessages'

type ConsentPreference = {
  id: string
  value: 'YES' | 'NO'
  consentFormulaId: string
  consentFormulaVersion: {
    title?: string | null
    text?: string | null
  }
}

const route = useRoute()

const token = computed(() => (route.query.token as string) || '')
const loadingDetails = ref(true)
const loading = ref(false)
const error = ref('')
const success = ref('')
const email = ref('')
const preferences = ref<Array<{
  consentId: string
  formulaId: string
  title: string
  text: string
  enabled: boolean
}>>([])
const revokeAll = ref(false)

function getPreferenceTitle(consent: ConsentPreference) {
  return consent.consentFormulaVersion.title || 'Comunicazione'
}

function getPreferenceText(consent: ConsentPreference) {
  return consent.consentFormulaVersion.text || 'Gestisci la ricezione di questa comunicazione.'
}

async function fetchPreferences() {
  if (!token.value) {
    error.value = 'Token preferenze mancante'
    loadingDetails.value = false
    return
  }

  try {
    const { data } = await axios.get<{
      email: string
      consents: ConsentPreference[]
    }>(`/public-api/unsubscribe?token=${encodeURIComponent(token.value)}`)

    email.value = data.email
    preferences.value = data.consents.map((consent) => ({
      consentId: consent.id,
      formulaId: consent.consentFormulaId,
      title: getPreferenceTitle(consent),
      text: getPreferenceText(consent),
      enabled: consent.value === 'YES',
    }))
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Preferenze comunicazioni non disponibili')
  } finally {
    loadingDetails.value = false
  }
}

async function savePreferences() {
  error.value = ''
  success.value = ''

  if (!token.value) {
    error.value = 'Token preferenze mancante'
    return
  }

  loading.value = true

  try {
    const { data } = await axios.post('/public-api/unsubscribe', {
      token: token.value,
      revokeAll: revokeAll.value,
      updates: revokeAll.value
        ? []
        : preferences.value.map((preference) => ({
            formulaId: preference.formulaId,
            keep: preference.enabled,
          })),
      reason: revokeAll.value ? 'unsubscribe_all' : 'preferences_updated',
    })

    success.value = getApiSuccessMessage(data, revokeAll.value
      ? 'Hai revocato tutte le comunicazioni.'
      : 'Preferenze comunicazioni aggiornate.')
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Aggiornamento preferenze non riuscito')
  } finally {
    loading.value = false
  }
}

onMounted(fetchPreferences)
</script>

<template>
  <div class="min-h-screen bg-background px-4 py-10">
    <div class="mx-auto w-full max-w-2xl">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-text-primary">Preferenze comunicazioni</h1>
        <p class="mt-2 text-sm text-text-secondary">
          Gestisci le email che desideri continuare a ricevere da MindCalm.
        </p>
      </div>

      <div class="card space-y-5 p-6">
        <AppStatusMessage v-if="success" :message="success" variant="success" />
        <AppStatusMessage v-if="error" :message="error" variant="error" />

        <div v-if="loadingDetails" class="text-sm text-text-secondary">
          Caricamento preferenze...
        </div>

        <template v-else-if="preferences.length">
          <div class="rounded-2xl bg-primary/5 px-4 py-4 text-sm">
            <p class="font-medium text-text-primary">{{ email }}</p>
            <p class="mt-1 text-text-secondary">Le modifiche si applicano immediatamente ai consensi attivi.</p>
          </div>

          <div class="space-y-3">
            <label
              v-for="preference in preferences"
              :key="preference.consentId"
              class="flex items-start gap-3 rounded-2xl border border-ui-border px-4 py-4"
            >
              <input
                v-model="preference.enabled"
                type="checkbox"
                class="mt-1 h-4 w-4 rounded border-ui-border"
                :disabled="revokeAll"
              />
              <div class="min-w-0">
                <p class="text-sm font-semibold text-text-primary">{{ preference.title }}</p>
                <p class="mt-1 text-sm text-text-secondary">{{ preference.text }}</p>
              </div>
            </label>
          </div>

          <label class="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
            <input v-model="revokeAll" type="checkbox" class="mt-1 h-4 w-4 rounded border-red-300" />
            <div>
              <p class="text-sm font-semibold text-red-700">Revoca tutte le comunicazioni</p>
              <p class="mt-1 text-sm text-red-600">
                Disattiva in un solo passaggio tutte le comunicazioni associate a questo indirizzo email.
              </p>
            </div>
          </label>

          <button type="button" :disabled="loading" class="btn-primary w-full" @click="savePreferences">
            {{ loading ? 'Salvataggio...' : 'Salva preferenze' }}
          </button>
        </template>

        <template v-else-if="!error">
          <div class="rounded-2xl border border-dashed border-ui-border px-4 py-8 text-center text-sm text-text-secondary">
            Nessuna preferenza disponibile per questo link.
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
