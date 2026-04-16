<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useUiStore } from '../stores/uiStore'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const menuContainer = ref<HTMLElement | null>(null)
const mobileMenuOpen = ref(false)
const profileMenuOpen = ref(false)
const isLoggingOut = ref(false)
const hasAudio = ref(true)
const hasPosts = ref(true)
const hasEvents = ref(true)

const isPublicVisitor = computed(() => !auth.isAuthenticated)

const navigationItems = computed(() => {
  if (isPublicVisitor.value) {
    const items = [{ label: 'Home', to: '/', description: 'Pagina principale' }]

    if (hasAudio.value) {
      items.push({ label: 'Audio', to: '/audio', description: 'Percorsi guidati gratuiti' })
    }
    if (hasPosts.value) {
      items.push({ label: 'Post', to: '/posts', description: 'Contenuti pubblici' })
    }
    if (hasEvents.value) {
      items.push({ label: 'Eventi', to: '/events', description: 'Incontri e appuntamenti' })
    }

    return items
  }

  const items = [{ label: 'Home', to: '/', description: 'Panoramica personale' }]

  if (hasAudio.value) {
    items.push({ label: 'Audio', to: '/audio', description: 'Percorsi guidati' })
  }
  if (hasPosts.value) {
    items.push({ label: 'Post', to: '/posts', description: 'Approfondimenti pubblici' })
  }
  if (hasEvents.value) {
    items.push({ label: 'Eventi', to: '/events', description: 'Agenda pubblica' })
  }

  return items
})

const userInitials = computed(() => {
  const source = auth.user?.name?.trim() || auth.user?.email || 'MC'

  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
})

function isActivePath(path: string) {
  return path === '/' ? route.path === path : route.path.startsWith(path)
}

function closeAllMenus() {
  mobileMenuOpen.value = false
  profileMenuOpen.value = false
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
  if (mobileMenuOpen.value) {
    profileMenuOpen.value = false
  }
}

function toggleProfileMenu() {
  profileMenuOpen.value = !profileMenuOpen.value
  if (profileMenuOpen.value) {
    mobileMenuOpen.value = false
  }
}

async function handleLogout() {
  if (isLoggingOut.value) return

  isLoggingOut.value = true

  try {
    await auth.logout()
    closeAllMenus()
    await router.push('/')
  } finally {
    isLoggingOut.value = false
  }
}

async function loadContentAvailability() {
  const requests = [
    axios.get('/api/posts?limit=1'),
    axios.get('/api/events?limit=1'),
  ]

  if (auth.isAuthenticated) {
    requests.unshift(axios.get('/api/audio?limit=1'))
  } else {
    hasAudio.value = false
  }

  const results = await Promise.allSettled(requests)
  const [audioResult, postsResult, eventsResult] = auth.isAuthenticated
    ? results
    : [null, results[0], results[1]]

  if (audioResult && audioResult.status === 'fulfilled') {
    hasAudio.value = Number(audioResult.value.data?.pagination?.total ?? 0) > 0
  }

  if (postsResult && postsResult.status === 'fulfilled') {
    hasPosts.value = Number(postsResult.value.data?.pagination?.total ?? 0) > 0
  }
  if (eventsResult && eventsResult.status === 'fulfilled') {
    hasEvents.value = Number(eventsResult.value.data?.pagination?.total ?? 0) > 0
  }
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Node)) return

  if (!menuContainer.value?.contains(target)) {
    closeAllMenus()
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeAllMenus()
  }
}

watch(
  () => route.fullPath,
  () => {
    closeAllMenus()
  },
)

watch(
  () => auth.isAuthenticated,
  () => {
    void loadContentAvailability()
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <nav
    ref="menuContainer"
    class="sticky top-0 z-40 border-b border-ui-border/80 bg-surface/94 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-surface/88"
  >
    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div class="flex min-h-[76px] items-center justify-between gap-4 py-4">
        <router-link
          to="/"
          class="flex min-w-0 items-center gap-3 rounded-2xl transition-colors hover:text-primary"
          aria-label="Vai alla home di MindCalm"
        >
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/20">
            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 2.75l1.54 3.388 3.71.431-2.757 2.526.75 3.681L10 10.924 6.757 12.776l.75-3.681L4.75 6.569l3.71-.431L10 2.75z" />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="truncate text-base font-semibold text-text-primary">MindCalm</p>
            <p class="truncate text-xs text-text-secondary">
              {{ isPublicVisitor ? 'Post pubblici, eventi e accesso riservato' : 'La tua area personale' }}
            </p>
          </div>
        </router-link>

        <div
          v-if="navigationItems.length"
          class="surface-pill hidden items-center gap-1 p-1.5 md:flex"
          aria-label="Navigazione principale"
        >
          <router-link
            v-for="item in navigationItems"
            :key="item.to"
            :to="item.to"
            class="rounded-full px-4 py-2 text-sm font-medium transition-all"
            :class="
              isActivePath(item.to)
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-text-secondary hover:bg-muted hover:text-text-primary'
            "
            :aria-current="isActivePath(item.to) ? 'page' : undefined"
          >
            {{ item.label }}
          </router-link>
        </div>

        <div class="hidden items-center gap-2 md:flex">
          <button
            type="button"
            class="surface-pill inline-flex h-11 w-11 items-center justify-center text-text-secondary transition-colors hover:border-primary/20 hover:text-primary"
            :aria-label="ui.isDark ? 'Attiva il tema chiaro' : 'Attiva il tema scuro'"
            @click="ui.toggleTheme()"
          >
            <svg v-if="ui.isDark" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>

          <template v-if="auth.isAuthenticated">
            <div class="relative">
              <button
                type="button"
                class="surface-pill flex items-center gap-3 px-3 py-2 text-left transition-all hover:border-primary/20 hover:shadow-sm"
                :aria-expanded="profileMenuOpen ? 'true' : 'false'"
                aria-haspopup="menu"
                aria-label="Apri il menu utente"
                @click="toggleProfileMenu"
              >
                <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {{ userInitials }}
                </div>
                <div class="min-w-0 max-w-[11rem]">
                  <p class="truncate text-sm font-semibold text-text-primary">{{ auth.user?.name || 'Utente' }}</p>
                  <p class="truncate text-xs text-text-secondary">{{ auth.user?.email }}</p>
                </div>
                <svg
                  class="h-4 w-4 text-text-secondary transition-transform"
                  :class="{ 'rotate-180': profileMenuOpen }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div
                v-if="profileMenuOpen"
                class="section-panel absolute right-0 mt-3 w-72 overflow-hidden shadow-xl"
                role="menu"
              >
                <div class="border-b border-ui-border px-5 py-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-semibold text-text-primary">{{ auth.user?.name || 'Utente' }}</p>
                      <p class="mt-1 text-sm text-text-secondary">{{ auth.user?.email }}</p>
                    </div>
                    <div v-if="auth.isPremiumUser" class="inline-flex items-center rounded-full bg-secondary/10 px-2 py-1 text-xs font-medium text-secondary">
                      Premium
                    </div>
                    <div v-else class="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      Free
                    </div>
                  </div>
                </div>

                <div class="p-2">
                  <router-link
                    to="/profile"
                    class="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-muted"
                    role="menuitem"
                  >
                    <svg class="h-5 w-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Impostazioni account
                  </router-link>

                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    role="menuitem"
                    :disabled="isLoggingOut"
                    @click="handleLogout"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
                    </svg>
                    {{ isLoggingOut ? 'Uscita...' : 'Esci' }}
                  </button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <router-link
              to="/login"
              class="surface-pill inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-text-primary transition-colors hover:border-primary/25 hover:text-primary"
            >
              Accedi
            </router-link>
            <router-link to="/register" class="btn-primary">
              Hai un invito?
            </router-link>
          </template>
        </div>

        <button
          type="button"
          class="surface-pill inline-flex h-11 w-11 items-center justify-center text-text-secondary transition-colors hover:border-primary/20 hover:text-primary md:hidden"
          :aria-expanded="mobileMenuOpen ? 'true' : 'false'"
          aria-controls="mobile-navigation"
          aria-label="Apri il menu di navigazione"
          @click="toggleMobileMenu"
        >
          <svg v-if="mobileMenuOpen" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <div v-if="mobileMenuOpen" id="mobile-navigation" class="border-t border-ui-border py-4 md:hidden">
        <div class="section-panel space-y-4 p-4">
          <div class="space-y-2">
            <router-link
              v-for="item in navigationItems"
              :key="`mobile-${item.to}`"
              :to="item.to"
              class="flex items-center justify-between rounded-[22px] border px-4 py-3 transition-colors"
              :class="
                isActivePath(item.to)
                  ? 'border-primary/20 bg-primary/10 text-primary'
                  : 'border-ui-border bg-surface/92 text-text-primary hover:bg-muted'
              "
              :aria-current="isActivePath(item.to) ? 'page' : undefined"
            >
              <div>
                <p class="text-sm font-semibold">{{ item.label }}</p>
                <p class="mt-0.5 text-xs text-text-secondary">{{ item.description }}</p>
              </div>
              <svg class="h-4 w-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </router-link>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="surface-pill inline-flex items-center justify-center rounded-[22px] px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-muted"
              @click="ui.toggleTheme()"
            >
              {{ ui.isDark ? 'Tema chiaro' : 'Tema scuro' }}
            </button>

            <template v-if="auth.isAuthenticated">
              <router-link
                to="/profile"
                class="surface-pill inline-flex items-center justify-center rounded-[22px] px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-muted"
              >
                Profilo
              </router-link>
            </template>

            <template v-else>
              <router-link
                to="/login"
                class="surface-pill inline-flex items-center justify-center rounded-[22px] px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-muted"
              >
                Accedi
              </router-link>
            </template>
          </div>

          <template v-if="auth.isAuthenticated">
            <button
              type="button"
              class="surface-pill flex w-full items-center justify-center gap-2 rounded-[22px] px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isLoggingOut"
              @click="handleLogout"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
              </svg>
              {{ isLoggingOut ? 'Uscita...' : 'Esci' }}
            </button>
          </template>

          <template v-else>
            <div class="surface-card-muted rounded-[22px] p-4">
              <p class="text-sm leading-6 text-text-secondary">
                Consulta post ed eventi pubblici. Se hai un invito, accedi all'area riservata per ascoltare i percorsi audio.
              </p>
              <router-link to="/register" class="btn-primary mt-4 flex w-full items-center justify-center">
                Hai un invito?
              </router-link>
            </div>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>
