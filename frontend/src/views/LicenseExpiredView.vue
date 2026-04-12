<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const expiresAt = computed(() => {
  const value = (route.query.expiresAt as string | undefined) || auth.licenseExpiredAt
  return value ? new Date(value) : null
})

const formattedExpiresAt = computed(() => {
  if (!expiresAt.value || Number.isNaN(expiresAt.value.getTime())) {
    return ''
  }

  return expiresAt.value.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

async function goToLogin() {
  auth.clearLicenseExpired()
  await router.push('/login')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="w-full max-w-lg card p-8 text-center">
      <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-100 text-red-600">
        <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v4m0 4h.01M10.29 3.86l-8 14A1 1 0 003.15 19h17.7a1 1 0 00.86-1.5l-8-14a1 1 0 00-1.72 0z" />
        </svg>
      </div>

      <h1 class="text-2xl font-bold text-text-primary">Licenza scaduta</h1>
      <p class="mt-3 text-sm leading-6 text-text-secondary">
        Il tuo account non ha piu accesso a MindCalm. Contatta l'amministratore per rinnovare la licenza.
      </p>

      <p v-if="formattedExpiresAt" class="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm text-text-primary">
        Scadenza registrata: <strong>{{ formattedExpiresAt }}</strong>
      </p>

      <div class="mt-6 flex justify-center">
        <button type="button" class="btn-primary" @click="goToLogin">
          Torna al login
        </button>
      </div>
    </div>
  </div>
</template>
