<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const registrationType = ref<'free' | 'premium' | null>(null)

function chooseFreeRegistration() {
  registrationType.value = 'free'
  router.push('/register/free')
}

function choosePremiumRegistration() {
  registrationType.value = 'premium'
  router.push('/register/premium')
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-text-primary mb-2">Benvenuto su MindCalm</h1>
        <p class="text-text-secondary">Scegli il tipo di registrazione che fa per te</p>
      </div>

      <div class="space-y-4">
        <!-- Registrazione Free -->
        <div class="card hover:shadow-lg transition-shadow cursor-pointer" @click="chooseFreeRegistration">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-text-primary">Registrazione Gratuita</h2>
              <div class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                Free
              </div>
            </div>
            <ul class="space-y-2 text-sm text-text-secondary">
              <li class="flex items-center gap-2">
                <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Accesso ai contenuti pubblici
              </li>
              <li class="flex items-center gap-2">
                <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Notifiche su nuovi post ed eventi
              </li>
              <li class="flex items-center gap-2">
                <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Profilo personalizzato
              </li>
            </ul>
            <button class="w-full mt-6 bg-primary text-white py-3 rounded-2xl font-medium hover:bg-primary/90 transition-colors">
              Registrati Gratuitamente
            </button>
          </div>
        </div>

        <!-- Registrazione Premium -->
        <div class="card hover:shadow-lg transition-shadow cursor-pointer border-secondary/20" @click="choosePremiumRegistration">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-text-primary">Hai un Codice di Attivazione?</h2>
              <div class="inline-flex items-center rounded-full bg-secondary/10 px-3 py-1 text-sm font-medium text-secondary">
                Premium
              </div>
            </div>
            <ul class="space-y-2 text-sm text-text-secondary">
              <li class="flex items-center gap-2">
                <svg class="h-4 w-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Tutti i contenuti gratuiti
              </li>
              <li class="flex items-center gap-2">
                <svg class="h-4 w-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Accesso completo agli audio guidati
              </li>
              <li class="flex items-center gap-2">
                <svg class="h-4 w-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Contenuti esclusivi riservati
              </li>
            </ul>
            <button class="w-full mt-6 bg-secondary text-white py-3 rounded-2xl font-medium hover:bg-secondary/90 transition-colors">
              Usa Codice di Attivazione
            </button>
          </div>
        </div>
      </div>

      <div class="text-center mt-8 text-sm text-text-secondary">
        Hai già un account? 
        <router-link to="/login" class="text-primary hover:underline font-medium">Accedi</router-link>
      </div>
    </div>
  </div>
</template>