<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const users = ref<any[]>([])
const loading = ref(true)
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })

function getPublicAppBaseUrl() {
  return window.location.origin.endsWith(':5474')
    ? window.location.origin.replace(':5474', ':5473')
    : window.location.origin
}

async function fetchUsers() {
  loading.value = true
  try {
    const { data } = await axios.get(`/api/admin/users?page=${pagination.value.page}&limit=${pagination.value.limit}`)
    users.value = data.data
    pagination.value = { ...pagination.value, ...data.pagination }
  } finally {
    loading.value = false
  }
}

async function deleteUser(user: any) {
  if (!confirm(`Eliminare l'utente "${user.name}"?`)) return
  await axios.delete(`/api/admin/users/${user.id}`)
  await fetchUsers()
}

async function resendInvite(user: any) {
  await axios.post(`/api/admin/users/${user.id}/resend-invite`, {
    inviteBaseUrl: getPublicAppBaseUrl(),
  })
  await fetchUsers()
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT')
}

function getLicenseStatus(user: any) {
  if (user.role !== 'STANDARD') {
    return { label: 'Non applicabile', className: 'bg-gray-100 text-text-secondary' }
  }

  if (!user.licenseExpiresAt) {
    return { label: 'Nessuna scadenza', className: 'bg-sky-100 text-sky-700' }
  }

  const expiresAt = new Date(user.licenseExpiresAt)
  if (expiresAt.getTime() <= Date.now()) {
    return {
      label: `Scaduta il ${expiresAt.toLocaleDateString('it-IT')}`,
      className: 'bg-red-100 text-red-700',
    }
  }

  return {
    label: `Scade il ${expiresAt.toLocaleDateString('it-IT')}`,
    className: 'bg-emerald-100 text-emerald-700',
  }
}

onMounted(fetchUsers)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Utenti</h1>
        <p class="text-sm text-text-secondary mt-1">Gestisci account standard, admin e inviti</p>
      </div>
      <router-link to="/users/new" class="btn-primary">+ Nuovo utente</router-link>
    </div>

    <div class="table-container">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Nome</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Email</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Ruolo</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Stato</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Licenza</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Creato</th>
            <th class="table-actions-header px-4 py-3 text-xs font-medium text-text-secondary uppercase">Azioni</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-if="loading">
            <td colspan="7" class="px-4 py-8 text-center text-text-secondary">Caricamento...</td>
          </tr>
          <tr v-else-if="!users.length">
            <td colspan="7" class="px-4 py-8 text-center text-text-secondary">Nessun utente</td>
          </tr>
          <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50/50">
            <td class="px-4 py-3 text-sm font-medium text-text-primary">{{ user.name }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ user.email }}</td>
            <td class="px-4 py-3 text-sm">
              <span :class="['inline-flex px-2 py-1 rounded-full text-xs font-medium', user.role === 'ADMIN' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-text-secondary']">
                {{ user.role === 'ADMIN' ? 'Admin' : 'Standard' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <div class="flex flex-wrap gap-2">
                <span :class="['inline-flex px-2 py-1 rounded-full text-xs font-medium', user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700']">
                  {{ user.isActive ? 'Attivo' : 'Disattivato' }}
                </span>
                <span v-if="user.hasPendingInvite" class="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Invito pendente
                </span>
              </div>
            </td>
            <td class="px-4 py-3 text-sm">
              <span :class="['inline-flex px-2 py-1 rounded-full text-xs font-medium', getLicenseStatus(user).className]">
                {{ getLicenseStatus(user).label }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ formatDate(user.createdAt) }}</td>
            <td class="table-actions-cell">
              <div class="table-actions-group">
                <button
                  v-if="user.isActive"
                  @click="resendInvite(user)"
                  class="icon-action-button icon-action-button-warning"
                  title="Invia o reinvia invito"
                  aria-label="Invia o reinvia invito"
                >
                  <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.945a2 2 0 002.22 0L21 8m-18 8h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                  </svg>
                </button>
                <button
                  @click="router.push(`/users/${user.id}/edit`)"
                  class="icon-action-button icon-action-button-neutral"
                  title="Modifica"
                  aria-label="Modifica"
                >
                  <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button
                  @click="deleteUser(user)"
                  class="icon-action-button icon-action-button-danger"
                  title="Elimina"
                  aria-label="Elimina"
                >
                  <svg class="w-4 h-4 text-red-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
