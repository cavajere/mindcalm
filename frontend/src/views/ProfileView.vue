<script setup lang="ts">
import { computed, ref } from 'vue'
import axios from 'axios'
import AppStatusMessage from '../components/AppStatusMessage.vue'
import { useAuthStore } from '../stores/authStore'
import { getApiErrorMessage, getApiSuccessMessage } from '../utils/apiMessages'

const auth = useAuthStore()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const preferencesLoading = ref(false)
const preferencesSaving = ref(false)
const error = ref('')
const success = ref('')
const preferencesError = ref('')
const preferencesSuccess = ref('')
const notificationPrefs = ref({
  notifyOnAudio: true,
  notifyOnArticles: true,
  frequency: 'NONE',
})

const isFormValid = computed(() =>
  currentPassword.value.trim().length > 0 &&
  newPassword.value.length >= 8 &&
  confirmPassword.value === newPassword.value,
)

async function handleChangePassword() {
  error.value = ''
  success.value = ''

  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Le nuove password non coincidono'
    return
  }

  loading.value = true

  try {
    const { data } = await axios.post('/api/auth/app-change-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })

    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    success.value = getApiSuccessMessage(data, 'Password aggiornata')
  } catch (apiError) {
    error.value = getApiErrorMessage(apiError, 'Errore di connessione')
  } finally {
    loading.value = false
  }
}

async function loadNotificationPreferences() {
  preferencesLoading.value = true
  preferencesError.value = ''

  try {
    const { data } = await axios.get('/api/v1/auth/notification-preferences')
    notificationPrefs.value = {
      notifyOnAudio: Boolean(data.notifyOnAudio),
      notifyOnArticles: Boolean(data.notifyOnArticles),
      frequency: data.frequency || 'NONE',
    }
  } catch (e: any) {
    preferencesError.value = e.response?.data?.error || 'Errore caricamento preferenze notifiche'
  } finally {
    preferencesLoading.value = false
  }
}

async function saveNotificationPreferences() {
  preferencesSaving.value = true
  preferencesError.value = ''
  preferencesSuccess.value = ''

  try {
    await axios.put('/api/v1/auth/notification-preferences', notificationPrefs.value)
    preferencesSuccess.value = 'Preferenze notifiche aggiornate'
  } catch (e: any) {
    preferencesError.value = e.response?.data?.error || 'Errore aggiornamento preferenze notifiche'
  } finally {
    preferencesSaving.value = false
  }
}

loadNotificationPreferences()
</script>

<template>
  <div class="page-container max-w-2xl space-y-6">
    <div class="card p-6">
      <h1 class="text-2xl font-bold text-text-primary mb-2">Il tuo account</h1>
      <p class="text-text-secondary mb-6">Informazioni del profilo usato per accedere a MindCalm.</p>

      <div class="space-y-4">
        <div>
          <p class="text-sm text-text-secondary">Nome</p>
          <p class="text-text-primary font-medium">{{ auth.user?.name }}</p>
        </div>
        <div>
          <p class="text-sm text-text-secondary">Email</p>
          <p class="text-text-primary font-medium">{{ auth.user?.email }}</p>
        </div>
        <div>
          <p class="text-sm text-text-secondary">Ruolo</p>
          <p class="text-text-primary font-medium">{{ auth.user?.role === 'ADMIN' ? 'Admin' : 'Standard' }}</p>
        </div>
      </div>
    </div>

    <div class="card p-6 space-y-4">
      <div>
        <h2 class="text-xl font-semibold text-text-primary">Notifiche email nuovi contenuti</h2>
        <p class="text-text-secondary text-sm mt-1">
          Scegli se ricevere aggiornamenti per Audio e Articoli e con quale frequenza.
        </p>
      </div>

      <div v-if="preferencesError" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
        {{ preferencesError }}
      </div>
      <div v-if="preferencesSuccess" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
        {{ preferencesSuccess }}
      </div>

      <div class="space-y-2">
        <label class="inline-flex items-center gap-2">
          <input v-model="notificationPrefs.notifyOnAudio" type="checkbox" />
          <span>Aggiornami sui nuovi Audio</span>
        </label>
        <label class="inline-flex items-center gap-2">
          <input v-model="notificationPrefs.notifyOnArticles" type="checkbox" />
          <span>Aggiornami sui nuovi Articoli</span>
        </label>
      </div>

      <div>
        <label class="block text-sm font-medium text-text-primary mb-1">Frequenza invio</label>
        <select
          v-model="notificationPrefs.frequency"
          class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="NONE">Nessuna notifica</option>
          <option value="IMMEDIATE">Una notifica per ogni nuova pubblicazione</option>
          <option value="WEEKLY">Riepilogo settimanale</option>
          <option value="MONTHLY">Riepilogo mensile</option>
        </select>
      </div>

      <button type="button" class="btn-primary" :disabled="preferencesLoading || preferencesSaving" @click="saveNotificationPreferences">
        {{ preferencesSaving ? 'Salvataggio...' : 'Salva preferenze notifiche' }}
      </button>
    </div>

    <div class="card p-6">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 class="text-xl font-semibold text-text-primary">Cambia password</h2>
          <p class="text-text-secondary text-sm mt-1">Aggiorna la password del tuo account senza passare dall’email.</p>
        </div>

        <router-link to="/forgot-password" class="text-sm text-primary hover:underline whitespace-nowrap">
          Password dimenticata?
        </router-link>
      </div>

      <form @submit.prevent="handleChangePassword" class="space-y-4">
        <AppStatusMessage v-if="error" :message="error" variant="error" />
        <AppStatusMessage v-if="success" :message="success" variant="success" />

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1">Password attuale</label>
          <input
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            required
            class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="Inserisci la password attuale"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1">Nuova password</label>
          <input
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            minlength="8"
            required
            class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="Minimo 8 caratteri"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1">Conferma nuova password</label>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            minlength="8"
            required
            class="w-full px-3 py-3 rounded-xl border border-gray-200 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="Ripeti la nuova password"
          />
          <p v-if="confirmPassword && confirmPassword !== newPassword" class="mt-2 text-sm text-red-600">
            Le nuove password non coincidono.
          </p>
        </div>

        <button type="submit" :disabled="loading || !isFormValid" class="btn-primary">
          {{ loading ? 'Aggiornamento...' : 'Aggiorna password' }}
        </button>
      </form>
    </div>
  </div>
</template>
