<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const isDev = import.meta.env.DEV

const email = ref(isDev ? 'admin@mindcalm.com' : '')
const password = ref(isDev ? 'admin123!' : '')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    const redirectPath = typeof route.query.redirect === 'string' ? route.query.redirect : auth.getDefaultRoute()
    await router.push(redirectPath)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore di connessione'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a4 4 0 00-4 4v1a2 2 0 00-2 2v5a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2V6a4 4 0 00-4-4z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-text-primary">MindCalm Admin</h1>
        <p class="text-text-secondary text-sm mt-1">
          {{ !auth.hasActiveAdmin && auth.bootstrapEnabled ? 'Accedi con le credenziali bootstrap per creare il primo admin.' : 'Accedi al pannello di gestione' }}
        </p>
      </div>

      <div v-if="!auth.hasActiveAdmin && !auth.bootstrapEnabled" class="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
        Nessun admin attivo e bootstrap ENV non configurato. Il backend non può autorizzare accessi admin finché non viene configurato un bootstrap admin.
      </div>

      <div v-if="isDev" class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <p class="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Dev credentials</p>
        <div class="flex items-center justify-between text-sm text-amber-900">
          <span class="font-mono">admin@mindcalm.com</span>
        </div>
        <div class="flex items-center justify-between text-sm text-amber-900 mt-1">
          <span class="font-mono">admin123!</span>
        </div>
      </div>

      <form @submit.prevent="handleLogin" class="card space-y-4">
        <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
          {{ error }}
        </div>

        <div>
          <label class="label">Email</label>
          <input v-model="email" type="email" required class="input-field" placeholder="admin@mindcalm.com" />
        </div>

        <div>
          <label class="label">Password</label>
          <input v-model="password" type="password" required class="input-field" placeholder="Password" />
        </div>

        <div class="text-right">
          <router-link to="/forgot-password" class="text-sm text-primary hover:underline">
            Password dimenticata?
          </router-link>
        </div>

        <button type="submit" :disabled="loading || (!auth.hasActiveAdmin && !auth.bootstrapEnabled)" class="btn-primary w-full">
          {{ !auth.hasActiveAdmin && !auth.bootstrapEnabled ? 'Bootstrap non configurato' : (loading ? 'Accesso...' : 'Accedi') }}
        </button>
      </form>
    </div>
  </div>
</template>
