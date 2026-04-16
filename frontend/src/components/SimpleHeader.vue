<script setup lang="ts">
import { useUiStore } from '../stores/uiStore'

const ui = useUiStore()
</script>

<template>
  <nav class="sticky top-0 z-40 border-b border-ui-border/80 bg-surface/94 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-surface/88">
    <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
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
            <p class="truncate text-xs text-text-secondary">Torna alla home</p>
          </div>
        </router-link>

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
      </div>
    </div>
  </nav>
</template>