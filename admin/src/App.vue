<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from './stores/authStore'
import { useRouter, useRoute } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const publicUrl = import.meta.env.DEV ? 'http://localhost:5473' : '/'

type NavLeafItem = {
  path: string
  label: string
  shortLabel: string
}

type NavGroupItem = {
  key: string
  label: string
  shortLabel: string
  children: NavLeafItem[]
}

type NavItem = NavLeafItem | NavGroupItem

const primaryNavItems: NavLeafItem[] = [
  { path: '/', label: 'Dashboard', shortLabel: 'Home' },
  { path: '/audio', label: 'Audio', shortLabel: 'Audio' },
  { path: '/articles', label: 'Articoli', shortLabel: 'Articoli' },
  { path: '/analytics', label: 'Analytics', shortLabel: 'Analytics' },
  { path: '/users', label: 'Utenti', shortLabel: 'Utenti' },
  { path: '/invite-codes', label: 'Codici invito', shortLabel: 'CI' },
]

const adminNavItems: NavLeafItem[] = [
  { path: '/settings/smtp', label: 'SMTP', shortLabel: 'SMTP' },
  { path: '/audit-logs', label: 'Log attivita', shortLabel: 'Log' },
  { path: '/categories', label: 'Categorie', shortLabel: 'Categorie' },
  { path: '/tags', label: 'Tag', shortLabel: 'Tag' },
]

const navItems: NavItem[] = [
  ...primaryNavItems,
  {
    key: 'admin',
    label: 'Admin',
    shortLabel: 'AD',
    children: adminNavItems,
  },
]

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)
const profileMenuOpen = ref(false)
const expandedGroupKey = ref<string | null>(null)

function hasChildren(item: NavItem): item is NavGroupItem {
  return 'children' in item
}

const flatNavItems = computed(() =>
  navItems.flatMap((item) => (hasChildren(item) ? item.children : [item])),
)

const currentSection = computed(() => {
  if (route.path === '/profile') {
    return { label: 'Profilo', shortLabel: 'Profilo' }
  }

  return flatNavItems.value.find((item) =>
    item.path === '/' ? route.path === item.path : route.path.startsWith(item.path),
  ) ?? { label: 'Admin', shortLabel: 'Admin' }
})

const userInitials = computed(() => {
  const source = auth.user?.name || auth.user?.email || 'MC'
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
})

const userRoleLabel = computed(() => (auth.user?.role === 'ADMIN' ? 'Admin' : 'Standard'))

function isActivePath(path: string) {
  return path === '/' ? route.path === path : route.path.startsWith(path)
}

function isGroupActive(item: NavGroupItem) {
  return item.children.some((child) => isActivePath(child.path))
}

function syncExpandedGroupWithRoute() {
  const activeGroup = navItems.find((item) => hasChildren(item) && isGroupActive(item))
  expandedGroupKey.value = activeGroup && hasChildren(activeGroup) ? activeGroup.key : null
}

function baseNavItemClasses(active: boolean, nested = false) {
  return [
    'group flex items-center rounded-2xl text-sm font-medium transition-all',
    sidebarCollapsed.value
      ? 'justify-center px-4 py-3'
      : nested
        ? 'px-3 py-2.5'
        : 'gap-3 px-4 py-3',
    active
      ? 'bg-white text-slate-950 shadow-sm'
      : 'text-slate-300 hover:bg-white/8 hover:text-white',
  ]
}

function navItemClasses(path: string) {
  return baseNavItemClasses(isActivePath(path))
}

function navGroupClasses(item: NavGroupItem) {
  return baseNavItemClasses(isGroupActive(item) || expandedGroupKey.value === item.key)
}

function childNavItemClasses(path: string) {
  return [
    'flex items-center rounded-xl px-3 py-2 text-sm transition-all',
    isActivePath(path)
      ? 'bg-white/10 text-white'
      : 'text-slate-400 hover:bg-white/6 hover:text-slate-200',
  ]
}

function navIconClasses(active: boolean, nested = false) {
  return [
    'inline-flex shrink-0 items-center justify-center rounded-xl text-xs font-semibold',
    nested && !sidebarCollapsed.value ? 'h-8 w-8' : 'h-9 w-9',
    active ? 'bg-slate-950 text-white' : 'bg-white/8 text-slate-300 group-hover:bg-white/12',
  ]
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function toggleGroup(item: NavGroupItem) {
  if (sidebarCollapsed.value) {
    sidebarCollapsed.value = false
    expandedGroupKey.value = item.key
    return
  }

  expandedGroupKey.value = expandedGroupKey.value === item.key ? null : item.key
}

function openMobileSidebar() {
  sidebarCollapsed.value = false
  mobileSidebarOpen.value = true
}

function closeMobileSidebar() {
  mobileSidebarOpen.value = false
}

function toggleProfileMenu() {
  profileMenuOpen.value = !profileMenuOpen.value
}

function closeProfileMenu() {
  profileMenuOpen.value = false
}

async function handleLogout() {
  closeProfileMenu()
  closeMobileSidebar()
  await auth.logout()
  router.push('/login')
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('[data-profile-menu]')) {
    closeProfileMenu()
  }
}

watch(
  () => route.fullPath,
  () => {
    closeProfileMenu()
    closeMobileSidebar()
    syncExpandedGroupWithRoute()
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div v-if="!auth.initialized" class="flex min-h-screen items-center justify-center bg-background px-6">
    <div class="w-full max-w-sm rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
        MC
      </div>
      <p class="text-sm font-medium text-slate-900">Verifica sessione in corso</p>
      <p class="mt-2 text-sm text-slate-500">Controllo autenticazione admin...</p>
    </div>
  </div>

  <div v-else-if="auth.isAuthenticated" class="min-h-screen bg-background text-text-primary">
    <div v-if="mobileSidebarOpen" class="fixed inset-0 z-40 bg-text-primary/35 lg:hidden" @click="closeMobileSidebar" />

    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-slate-950 text-slate-100 shadow-2xl transition-all duration-300',
        sidebarCollapsed ? 'w-[88px]' : 'w-72',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <div :class="['flex items-center border-b border-white/10', sidebarCollapsed ? 'justify-center px-3 py-5' : 'justify-between px-5 py-5']">
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-sky-400 to-secondary shadow-lg shadow-primary/20">
            <svg class="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a4 4 0 00-4 4v1a2 2 0 00-2 2v5a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2V6a4 4 0 00-4-4z" />
            </svg>
          </div>
          <div v-if="!sidebarCollapsed" class="min-w-0">
            <p class="truncate text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">MindCalm</p>
            <p class="truncate text-lg font-semibold text-white">Admin Portal</p>
          </div>
        </div>
      </div>

      <div class="px-4 py-4">
        <a
          :href="publicUrl"
          target="_blank"
          :class="[
            'flex items-center rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/20 hover:bg-white/10',
            sidebarCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3',
          ]"
        >
          <svg class="h-5 w-5 shrink-0 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <div v-if="!sidebarCollapsed" class="min-w-0">
            <p class="text-sm font-medium text-white">Sito pubblico</p>
            <p class="text-xs text-slate-400">Apri l’esperienza utente</p>
          </div>
        </a>
      </div>

      <nav class="flex-1 px-3 pb-4">
        <div class="space-y-1">
          <template v-for="item in navItems" :key="hasChildren(item) ? item.key : item.path">
            <router-link
              v-if="!hasChildren(item)"
              :to="item.path"
              :title="sidebarCollapsed ? item.label : undefined"
              :class="navItemClasses(item.path)"
            >
              <span :class="navIconClasses(isActivePath(item.path))">
                {{ item.shortLabel.slice(0, 2).toUpperCase() }}
              </span>
              <span v-if="!sidebarCollapsed" class="truncate">{{ item.label }}</span>
            </router-link>

            <div v-else class="space-y-1">
              <button
                type="button"
                :title="sidebarCollapsed ? item.label : undefined"
                :class="navGroupClasses(item)"
                :aria-expanded="!sidebarCollapsed && expandedGroupKey === item.key"
                @click="toggleGroup(item)"
              >
                <span :class="navIconClasses(isGroupActive(item) || expandedGroupKey === item.key)">
                  {{ item.shortLabel.slice(0, 2).toUpperCase() }}
                </span>
                <span v-if="!sidebarCollapsed" class="min-w-0 flex-1 truncate text-left">{{ item.label }}</span>
                <svg
                  v-if="!sidebarCollapsed"
                  class="h-4 w-4 shrink-0 transition-transform"
                  :class="expandedGroupKey === item.key ? 'rotate-90 text-white' : 'text-slate-500'"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <div
                v-if="!sidebarCollapsed && expandedGroupKey === item.key"
                class="ml-7 space-y-1 border-l border-white/10 pl-3"
              >
                <router-link
                  v-for="child in item.children"
                  :key="child.path"
                  :to="child.path"
                  :class="childNavItemClasses(child.path)"
                >
                  <span class="truncate">{{ child.label }}</span>
                </router-link>
              </div>
            </div>
          </template>
        </div>
      </nav>

      <div class="border-t border-white/10 p-3">
        <div
          :class="[
            'mt-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5',
            sidebarCollapsed ? 'hidden' : 'block',
          ]"
        >
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-sm font-semibold text-white">
              {{ userInitials }}
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-white">{{ auth.user?.name }}</p>
              <p class="truncate text-xs text-slate-400">{{ auth.user?.email }}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <div :class="['min-h-screen transition-all duration-300', sidebarCollapsed ? 'lg:pl-[88px]' : 'lg:pl-72']">
      <header class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div class="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div class="flex min-w-0 items-center gap-3">
            <button
              type="button"
              class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
              @click="openMobileSidebar"
              aria-label="Apri menu"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              class="hidden h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:inline-flex"
              @click="toggleSidebar"
              :aria-label="sidebarCollapsed ? 'Espandi sidebar' : 'Collassa sidebar'"
            >
              <svg
                class="h-5 w-5 transition-transform"
                :class="sidebarCollapsed ? 'rotate-180' : ''"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Admin</p>
              <h1 class="truncate text-xl font-semibold text-slate-900">{{ currentSection.label }}</h1>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
              <p class="text-sm font-medium text-slate-900">{{ auth.user?.name }}</p>
              <p class="text-xs text-slate-500">{{ userRoleLabel }}</p>
            </div>

            <div class="relative" data-profile-menu>
              <button
                type="button"
                class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                @click.stop="toggleProfileMenu"
                aria-label="Apri menu profilo"
              >
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-semibold text-white">
                  {{ userInitials }}
                </div>
                <div class="hidden text-left sm:block">
                  <p class="max-w-[160px] truncate text-sm font-medium text-slate-900">{{ auth.user?.name }}</p>
                  <p class="max-w-[160px] truncate text-xs text-slate-500">{{ auth.user?.email }}</p>
                </div>
                <svg class="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div
                v-if="profileMenuOpen"
                class="absolute right-0 mt-3 w-64 rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10"
              >
                <div class="rounded-2xl bg-slate-50 px-4 py-3">
                  <p class="text-sm font-medium text-slate-900">{{ auth.user?.name }}</p>
                  <p class="text-xs text-slate-500">{{ auth.user?.email }}</p>
                </div>

                <div class="mt-2 space-y-1">
                  <router-link
                    to="/profile"
                    class="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                    @click="closeProfileMenu"
                  >
                    <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5.121 17.804A11.956 11.956 0 0112 15.75c2.553 0 4.919.8 6.879 2.054M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Visualizza profilo
                  </router-link>
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-red-600 transition hover:bg-red-50"
                    @click="handleLogout"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3-3h9m0 0l-3-3m3 3l-3 3" />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="px-4 py-6 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <router-view />
        </div>
      </main>
    </div>
  </div>

  <div v-else>
    <router-view />
  </div>
</template>
