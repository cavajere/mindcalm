<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useToast } from '../composables/useToast'
import { getApiErrorMessage } from '../utils/apiMessages'

const router = useRouter()
const toast = useToast()
const users = ref<any[]>([])
const loading = ref(true)
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const confirmDeleteOpen = ref(false)
const userToDelete = ref<any>(null)

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

function confirmDelete(user: any) {
  userToDelete.value = user
  confirmDeleteOpen.value = true
}

async function deleteUser() {
  if (!userToDelete.value) return
  try {
    await axios.delete(`/api/admin/users/${userToDelete.value.id}`)
    confirmDeleteOpen.value = false
    userToDelete.value = null
    toast.success('Utente eliminato')
    await fetchUsers()
  } catch (e: unknown) {
    confirmDeleteOpen.value = false
    toast.error(getApiErrorMessage(e, 'Errore durante l\'eliminazione'))
  }
}

async function resendInvite(user: any) {
  try {
    await axios.post(`/api/admin/users/${user.id}/resend-invite`)
    toast.success('Invito reinviato')
    await fetchUsers()
  } catch (e: unknown) {
    toast.error(getApiErrorMessage(e, 'Errore reinvio invito'))
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT')
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function getLicenseStatus(user: any) {
  if (user.role !== 'STANDARD') {
    return { label: 'Non applicabile', className: 'bg-gray-100 text-text-secondary' }
  }

  if (!user.licenseExpiresAt) {
    return { label: 'A vita', className: 'bg-sky-100 text-sky-700' }
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

function getNotificationFrequencyLabel(frequency: string) {
  switch (frequency) {
    case 'IMMEDIATE':
      return 'Immediate'
    case 'WEEKLY':
      return 'Settimanali'
    case 'MONTHLY':
      return 'Mensili'
    default:
      return 'Disattivate'
  }
}

type NotificationChannel = { key: 'audio' | 'posts' | 'events'; label: string }

function getNotificationSummary(user: any) {
  const preferences = user.notificationPreferences
  if (!preferences || preferences.frequency === 'NONE') {
    return {
      frequency: getNotificationFrequencyLabel('NONE'),
      channels: [] as NotificationChannel[],
      className: 'bg-gray-100 text-text-secondary',
    }
  }

  const channels: NotificationChannel[] = [
    preferences.notifyOnAudio ? { key: 'audio', label: 'Audio' } : null,
    preferences.notifyOnPosts ? { key: 'posts', label: 'Post' } : null,
    preferences.notifyOnEvents ? { key: 'events', label: 'Eventi' } : null,
  ].filter((value): value is NotificationChannel => Boolean(value))

  return {
    frequency: getNotificationFrequencyLabel(preferences.frequency),
    channels,
    className: 'bg-indigo-100 text-indigo-700',
  }
}

onMounted(fetchUsers)
</script>

<template>
  <div>
    <PageHeader
      title="Utenti"
      description="Gestisci account standard, admin e inviti."
    >
      <template #actions>
        <router-link to="/users/new" class="btn-primary">+ Nuovo utente</router-link>
      </template>
    </PageHeader>

    <div class="table-container">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Nome</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Email</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-text-secondary uppercase">Ruolo</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-text-secondary uppercase">Tier</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-text-secondary uppercase">Stato</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-text-secondary uppercase">Licenza</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-text-secondary uppercase">Notifiche</th>
            <th class="text-center px-4 py-3 text-xs font-medium text-text-secondary uppercase">Creato</th>
            <th class="table-actions-header px-4 py-3 text-xs font-medium text-text-secondary uppercase">Azioni</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-if="loading">
            <td colspan="9" class="px-4 py-8 text-center text-text-secondary">Caricamento...</td>
          </tr>
          <tr v-else-if="!users.length">
            <td colspan="9" class="px-4 py-8 text-center text-text-secondary">Nessun utente</td>
          </tr>
          <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50/50">
            <td class="px-4 py-3 text-sm font-medium text-text-primary">{{ user.name }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ user.email }}</td>
            <td class="px-4 py-3 text-sm text-center">
              <span :class="['inline-flex px-2 py-1 rounded-full text-xs font-medium', user.role === 'ADMIN' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-text-secondary']">
                {{ user.role === 'ADMIN' ? 'Admin' : 'Standard' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-center">
              <span :class="['inline-flex px-2 py-1 rounded-full text-xs font-medium', user.tier === 'PREMIUM' ? 'bg-secondary/10 text-secondary' : 'bg-gray-100 text-text-secondary']">
                {{ user.tier === 'PREMIUM' ? 'Premium' : 'Free' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <div class="flex flex-wrap justify-center gap-2">
                <span :class="['inline-flex px-2 py-1 rounded-full text-xs font-medium', user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700']">
                  {{ user.isActive ? 'Attivo' : 'Disattivato' }}
                </span>
                <span v-if="user.hasPendingInvite" class="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Invito pendente
                </span>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-center">
              <span :class="['inline-flex px-2 py-1 rounded-full text-xs font-medium', getLicenseStatus(user).className]">
                {{ getLicenseStatus(user).label }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <div class="flex flex-wrap items-center justify-center gap-2">
                <span :class="['inline-flex px-2 py-1 rounded-full text-xs font-medium', getNotificationSummary(user).className]">
                  {{ getNotificationSummary(user).frequency }}
                </span>
                <span
                  v-for="channel in getNotificationSummary(user).channels"
                  :key="channel.key"
                  v-tooltip="channel.label"
                  :aria-label="channel.label"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600"
                >
                  <svg v-if="channel.key === 'audio'" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-3a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <svg v-else-if="channel.key === 'posts'" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-6 4h6m-6-8h6"/>
                  </svg>
                  <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </span>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-center text-text-secondary">
              <div>{{ formatDate(user.createdAt) }}</div>
              <div class="text-xs text-text-secondary/70">{{ formatTime(user.createdAt) }}</div>
            </td>
            <td class="table-actions-cell">
              <div class="table-actions-group">
                <button
                  v-if="user.isActive"
                  @click="resendInvite(user)"
                  class="icon-action-button icon-action-button-warning"
                  v-tooltip="'Invia o reinvia invito'"
                  aria-label="Invia o reinvia invito"
                >
                  <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </button>
                <button
                  @click="router.push(`/users/${user.id}/edit`)"
                  class="icon-action-button icon-action-button-neutral"
                  v-tooltip="'Modifica utente'"
                  aria-label="Modifica utente"
                >
                  <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button
                  @click="confirmDelete(user)"
                  class="icon-action-button icon-action-button-danger"
                  v-tooltip="'Elimina utente'"
                  aria-label="Elimina utente"
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

    <ConfirmDialog
      :open="confirmDeleteOpen"
      title="Elimina utente"
      :message="`Vuoi eliminare l'utente \u00AB${userToDelete?.name}\u00BB? Questa azione non può essere annullata.`"
      confirm-label="Elimina"
      cancel-label="Annulla"
      variant="danger"
      @confirm="deleteUser"
      @cancel="confirmDeleteOpen = false; userToDelete = null"
    />
  </div>
</template>
