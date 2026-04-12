<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const PHONE_REGEX = /^\+?[0-9\s().-]{7,20}$/

const auth = useAuthStore()
const router = useRouter()

const form = ref({
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

const loading = ref(false)
const error = ref('')

async function handleCancel() {
  await auth.logout()
  await router.push('/login')
}

function isPhoneValid(phone: string) {
  const normalized = phone.trim()
  const digitsOnly = normalized.replace(/\D/g, '')
  return PHONE_REGEX.test(normalized) && digitsOnly.length >= 7 && digitsOnly.length <= 15
}

async function handleSubmit() {
  error.value = ''

  if (form.value.password !== form.value.confirmPassword) {
    error.value = 'Le password non coincidono'
    return
  }

  if (!isPhoneValid(form.value.phone)) {
    error.value = 'Numero di telefono non valido'
    return
  }

  loading.value = true

  try {
    await auth.completeBootstrapSetup({
      email: form.value.email,
      firstName: form.value.firstName,
      lastName: form.value.lastName,
      phone: form.value.phone,
      password: form.value.password,
    })
    await router.push('/')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Configurazione iniziale non riuscita'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background px-4 py-10 sm:px-6">
    <div class="mx-auto w-full max-w-2xl">
      <div class="mb-8 text-center">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-lg font-semibold text-white">
          MC
        </div>
        <h1 class="text-3xl font-bold text-text-primary">Configurazione iniziale admin</h1>
        <p class="mt-2 text-sm text-text-secondary">
          Crea il primo amministratore reale. Dopo questo passaggio, le credenziali bootstrap da ENV verranno disattivate automaticamente.
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="card space-y-5">
        <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          Sessione bootstrap attiva come <span class="font-medium">{{ auth.user?.email }}</span>.
          Questa modalità serve solo per il primo setup.
        </div>

        <div v-if="error" class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {{ error }}
        </div>

        <div>
          <label class="label">Email admin</label>
          <input v-model="form.email" type="email" required class="input-field" placeholder="admin@mindcalm.com" />
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="label">Nome</label>
            <input v-model="form.firstName" type="text" required class="input-field" placeholder="Mario" />
          </div>
          <div>
            <label class="label">Cognome</label>
            <input v-model="form.lastName" type="text" required class="input-field" placeholder="Rossi" />
          </div>
        </div>

        <div>
          <label class="label">Telefono</label>
          <input v-model="form.phone" type="tel" required class="input-field" placeholder="+39 333 123 4567" />
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="label">Password</label>
            <input v-model="form.password" type="password" minlength="8" required class="input-field" placeholder="Minimo 8 caratteri" />
          </div>
          <div>
            <label class="label">Conferma password</label>
            <input v-model="form.confirmPassword" type="password" minlength="8" required class="input-field" placeholder="Ripeti la password" />
          </div>
        </div>

        <div class="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn-secondary" @click="handleCancel">
            Annulla
          </button>
          <button type="submit" :disabled="loading" class="btn-primary">
            {{ loading ? 'Creazione admin...' : 'Completa configurazione' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
