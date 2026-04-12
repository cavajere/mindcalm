<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const PHONE_REGEX = /^\+?[0-9\s().-]{7,20}$/
const MAX_NOTES_LENGTH = 5000
const route = useRoute()
const router = useRouter()

function getPublicAppBaseUrl() {
  return window.location.origin.endsWith(':5474')
    ? window.location.origin.replace(':5474', ':5473')
    : window.location.origin
}

const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const resendingInvite = ref(false)
const error = ref('')
const success = ref('')
const form = ref({
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  notes: '',
  role: 'STANDARD',
  licenseExpiresAt: '',
  password: '',
  isActive: true,
  sendInvite: true,
})
const userMeta = ref({
  hasPendingInvite: false,
  invitedAt: '',
})

function splitFullName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, ' ')
  if (!normalized) return { firstName: '', lastName: '' }

  const [firstName, ...rest] = normalized.split(' ')
  return {
    firstName,
    lastName: rest.join(' '),
  }
}

function isPhoneValid(phone: string) {
  const normalized = phone.trim()
  const digitsOnly = normalized.replace(/\D/g, '')
  return PHONE_REGEX.test(normalized) && digitsOnly.length >= 7 && digitsOnly.length <= 15
}

function formatDateForInput(value: string | null | undefined) {
  if (!value) return ''

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLicenseExpiresAtPayload() {
  if (form.value.role !== 'STANDARD') {
    return null
  }

  if (!form.value.licenseExpiresAt) {
    return null
  }

  const endOfDay = new Date(`${form.value.licenseExpiresAt}T23:59:59.999`)
  return endOfDay.toISOString()
}

async function fetchUser() {
  if (!isEdit.value) return

  const { data } = await axios.get(`/api/admin/users/${route.params.id}`)
  form.value.email = data.email
  const fallbackName = splitFullName(data.name || '')
  form.value.firstName = data.firstName || fallbackName.firstName
  form.value.lastName = data.lastName || fallbackName.lastName
  form.value.phone = data.phone || ''
  form.value.notes = data.notes || ''
  form.value.role = data.role
  form.value.licenseExpiresAt = formatDateForInput(data.licenseExpiresAt)
  form.value.isActive = data.isActive
  userMeta.value.hasPendingInvite = data.hasPendingInvite
  userMeta.value.invitedAt = data.invitedAt || ''
}

async function handleSubmit() {
  error.value = ''
  success.value = ''

  if (!isPhoneValid(form.value.phone)) {
    error.value = 'Numero di telefono non valido'
    return
  }

  if (form.value.notes.length > MAX_NOTES_LENGTH) {
    error.value = 'Le note possono contenere al massimo 5000 caratteri'
    return
  }

  loading.value = true

  try {
    const payload = {
      email: form.value.email,
      firstName: form.value.firstName,
      lastName: form.value.lastName,
      phone: form.value.phone,
      notes: form.value.notes,
      role: form.value.role,
      licenseExpiresAt: getLicenseExpiresAtPayload(),
      isActive: form.value.isActive,
      password: isEdit.value
        ? (form.value.password || undefined)
        : (form.value.sendInvite ? undefined : (form.value.password || undefined)),
      sendInvite: !isEdit.value ? form.value.sendInvite : undefined,
      inviteBaseUrl: !isEdit.value && form.value.sendInvite ? getPublicAppBaseUrl() : undefined,
    }

    if (isEdit.value) {
      await axios.put(`/api/admin/users/${route.params.id}`, payload)
    } else {
      await axios.post('/api/admin/users', payload)
    }

    router.push('/users')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore di salvataggio'
  } finally {
    loading.value = false
  }
}

async function resendInvite() {
  if (!isEdit.value) return

  error.value = ''
  success.value = ''
  resendingInvite.value = true

  try {
    const { data } = await axios.post(`/api/admin/users/${route.params.id}/resend-invite`, {
      inviteBaseUrl: getPublicAppBaseUrl(),
    })

    success.value = data.message || 'Invito inviato'
    userMeta.value.hasPendingInvite = data.user?.hasPendingInvite ?? true
    userMeta.value.invitedAt = data.user?.invitedAt || new Date().toISOString()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Invio invito non riuscito'
  } finally {
    resendingInvite.value = false
  }
}

watch(
  () => form.value.role,
  (role) => {
    if (role === 'ADMIN') {
      form.value.licenseExpiresAt = ''
    }
  },
)

onMounted(fetchUser)
</script>

<template>
  <div class="mx-auto w-full max-w-2xl">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">{{ isEdit ? 'Modifica utente' : 'Nuovo utente' }}</h1>
        <p class="text-sm text-text-secondary mt-1">
          {{ isEdit ? 'Aggiorna ruolo, stato e credenziali' : 'Crea un account standard o admin' }}
        </p>
      </div>
      <router-link to="/users" class="btn-secondary">Annulla</router-link>
    </div>

    <form @submit.prevent="handleSubmit" class="card space-y-4">
      <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
        {{ error }}
      </div>

      <div v-if="success" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
        {{ success }}
      </div>

      <div v-if="isEdit && userMeta.hasPendingInvite" class="bg-primary/5 text-primary text-sm px-4 py-3 rounded-lg flex items-center justify-between gap-4">
        <div>
          <p class="font-medium">Invito in attesa</p>
          <p v-if="userMeta.invitedAt" class="text-xs mt-1">
            Inviato il {{ new Date(userMeta.invitedAt).toLocaleString('it-IT') }}
          </p>
        </div>
        <button type="button" @click="resendInvite" :disabled="resendingInvite || !form.isActive" class="btn-secondary whitespace-nowrap">
          {{ resendingInvite ? 'Invio...' : 'Reinvia invito' }}
        </button>
      </div>

      <div>
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
      </div>

      <div>
        <label class="label">Email</label>
        <input v-model="form.email" type="email" required class="input-field" placeholder="utente@example.com" />
      </div>

      <div>
        <label class="label">Telefono</label>
        <input
          v-model="form.phone"
          type="tel"
          required
          class="input-field"
          placeholder="+39 333 123 4567"
        />
        <p class="text-xs text-text-secondary mt-1">
          Inserisci un numero valido, anche con prefisso internazionale.
        </p>
      </div>

      <div>
        <div class="flex items-center justify-between gap-3">
          <label class="label">Note</label>
          <span class="text-xs text-text-secondary">{{ form.notes.length }}/{{ MAX_NOTES_LENGTH }}</span>
        </div>
        <textarea
          v-model="form.notes"
          rows="5"
          :maxlength="MAX_NOTES_LENGTH"
          class="input-field"
          placeholder="Note interne sull'utente"
        />
      </div>

      <div>
        <label class="label">Ruolo</label>
        <select v-model="form.role" class="input-field">
          <option value="STANDARD">Standard</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      <div v-if="form.role === 'STANDARD'">
        <label class="label">Scadenza licenza</label>
        <input
          v-model="form.licenseExpiresAt"
          type="date"
          class="input-field"
        />
        <p class="text-xs text-text-secondary mt-1">
          Lascia vuoto per una licenza senza scadenza. La licenza resta valida fino alla fine del giorno selezionato.
        </p>
      </div>

      <template v-if="!isEdit">
        <label class="flex items-center gap-3 text-sm text-text-primary">
          <input v-model="form.sendInvite" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary/30" />
          Invia email di invito e lascia che l’utente imposti la password
        </label>

        <div v-if="form.sendInvite" class="bg-primary/5 text-sm text-text-secondary rounded-lg px-4 py-3">
          Verrà inviata un’email all’utente con un link per impostare la password al primo accesso.
        </div>

        <div v-else>
          <label class="label">Password</label>
          <input
            v-model="form.password"
            required
            type="password"
            minlength="8"
            class="input-field"
            placeholder="Minimo 8 caratteri"
          />
        </div>
      </template>

      <div v-else>
        <label class="label">Nuova password</label>
        <input
          v-model="form.password"
          type="password"
          minlength="8"
          class="input-field"
          placeholder="Lascia vuoto per mantenerla"
        />
        <p class="text-xs text-text-secondary mt-1">
          Se imposti una nuova password, eventuali inviti pendenti verranno annullati.
        </p>
      </div>

      <label class="flex items-center gap-3 text-sm text-text-primary">
        <input v-model="form.isActive" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary/30" />
        Account attivo
      </label>

      <div class="pt-2">
        <button type="submit" :disabled="loading" class="btn-primary">
          {{ loading ? 'Salvataggio...' : (isEdit ? 'Salva modifiche' : 'Crea utente') }}
        </button>
      </div>
    </form>
  </div>
</template>
