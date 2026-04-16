<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const notificationPrefs = ref({
  notifyOnAudio: true,
  notifyOnPosts: true,
  notifyOnEvents: true,
  frequency: 'NONE',
})
const notificationError = ref('')

const userRoleLabel = computed(() => (auth.user?.role === 'ADMIN' ? 'Amministratore' : 'Standard'))
const accountStatusLabel = computed(() => (auth.user?.isActive === false ? 'Disattivato' : 'Attivo'))
const initials = computed(() => {
  const source = auth.user?.name || auth.user?.email || 'MC'
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
})

const notificationFrequencyLabel = computed(() => {
  switch (notificationPrefs.value.frequency) {
    case 'IMMEDIATE':
      return 'Una notifica per ogni nuova pubblicazione'
    case 'WEEKLY':
      return 'Riepilogo settimanale'
    case 'MONTHLY':
      return 'Riepilogo mensile'
    default:
      return 'Nessuna notifica'
  }
})

async function loadNotificationPreferences() {
  notificationError.value = ''

  try {
    const { data } = await axios.get('/api/auth/notification-preferences')
    notificationPrefs.value = {
      notifyOnAudio: data.notifyOnAudio ?? true,
      notifyOnPosts: data.notifyOnPosts ?? true,
      notifyOnEvents: data.notifyOnEvents ?? true,
      frequency: data.frequency ?? 'NONE',
    }
  } catch (error: any) {
    notificationError.value = error.response?.data?.error || 'Errore caricamento preferenze notifiche'
  }
}

onMounted(loadNotificationPreferences)
</script>

<template>
  <div class="space-y-6">
    <section class="relative overflow-hidden rounded-[28px] bg-slate-950 p-8 text-white shadow-xl shadow-slate-900/10">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(107,170,232,0.35),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(80,184,96,0.28),_transparent_28%)]" />
      <div class="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-4">
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold">
            {{ initials }}
          </div>
          <div>
            <p class="text-sm uppercase tracking-[0.24em] text-slate-300">Profilo</p>
            <h2 class="text-3xl font-semibold">{{ auth.user?.name }}</h2>
            <p class="mt-2 text-sm text-slate-300">{{ auth.user?.email }}</p>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Ruolo</p>
            <p class="mt-1 text-sm font-medium text-white">{{ userRoleLabel }}</p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Stato account</p>
            <p class="mt-1 text-sm font-medium text-white">{{ accountStatusLabel }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div class="card space-y-6">
        <div>
          <p class="text-sm font-semibold text-text-primary">Dettagli account</p>
          <p class="mt-1 text-sm text-text-secondary">Dati del profilo dell’utente attualmente autenticato nel portale di amministrazione.</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Nome</p>
            <p class="mt-2 text-sm font-medium text-slate-900">{{ auth.user?.name || 'Non disponibile' }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Email</p>
            <p class="mt-2 text-sm font-medium text-slate-900">{{ auth.user?.email || 'Non disponibile' }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ruolo</p>
            <p class="mt-2 text-sm font-medium text-slate-900">{{ userRoleLabel }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Stato</p>
            <p class="mt-2 text-sm font-medium text-slate-900">{{ accountStatusLabel }}</p>
          </div>
        </div>

        <div class="rounded-3xl border border-slate-200 bg-white px-5 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-text-primary">Notifiche contenuti</p>
              <p class="mt-1 text-sm text-text-secondary">Riepilogo delle preferenze email attive per questo account admin.</p>
            </div>
            <span class="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
              {{ notificationFrequencyLabel }}
            </span>
          </div>

          <div v-if="notificationError" class="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {{ notificationError }}
          </div>

          <div v-else class="mt-4 flex flex-wrap gap-2">
            <span
              class="inline-flex rounded-full px-3 py-1 text-xs font-medium"
              :class="notificationPrefs.notifyOnAudio ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
            >
              {{ notificationPrefs.notifyOnAudio ? 'Audio attivi' : 'Audio disattivati' }}
            </span>
            <span
              class="inline-flex rounded-full px-3 py-1 text-xs font-medium"
              :class="notificationPrefs.notifyOnPosts ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
            >
              {{ notificationPrefs.notifyOnPosts ? 'Post attivi' : 'Post disattivati' }}
            </span>
            <span
              class="inline-flex rounded-full px-3 py-1 text-xs font-medium"
              :class="notificationPrefs.notifyOnEvents ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
            >
              {{ notificationPrefs.notifyOnEvents ? 'Eventi attivi' : 'Eventi disattivati' }}
            </span>
          </div>
        </div>
      </div>

      <aside class="card">
        <p class="text-sm font-semibold text-text-primary">Accesso admin</p>
        <div class="mt-4 space-y-3">
          <div class="rounded-2xl bg-primary/10 px-4 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">Sessione</p>
            <p class="mt-2 text-sm text-text-primary">Autenticazione attiva nel portale admin.</p>
          </div>
          <div class="rounded-2xl bg-secondary/10 px-4 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-dark">Permessi</p>
            <p class="mt-2 text-sm text-text-primary">Le azioni disponibili dipendono dal ruolo assegnato all’account.</p>
          </div>
        </div>
      </aside>
    </section>
  </div>
</template>
