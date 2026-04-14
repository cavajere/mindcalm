<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const route = useRoute()
const auth = useAuthStore()

const isPublicArea = computed(() => !auth.isAuthenticated)

function isActivePath(path: string) {
  return route.path === path
}
</script>

<template>
  <footer class="mt-12 border-t border-ui-border/80 bg-surface/92">
    <div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold text-text-primary">MindCalm</p>
        <p class="mt-2 text-sm leading-7 text-text-secondary">
          {{ isPublicArea
            ? 'Articoli pubblici, eventi e accesso riservato in un ambiente piu chiaro e leggibile.'
            : 'La tua area personale resta separata dai contenuti pubblici e dai documenti legali consultabili in ogni momento.' }}
        </p>
      </div>

      <nav aria-label="Collegamenti legali" class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <router-link
          to="/termini-e-condizioni"
          class="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors"
          :class="isActivePath('/termini-e-condizioni') ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'surface-pill text-text-primary hover:border-primary/25 hover:text-primary'"
        >
          Termini e condizioni
        </router-link>
        <router-link
          to="/privacy-policy"
          class="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors"
          :class="isActivePath('/privacy-policy') ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'surface-pill text-text-primary hover:border-primary/25 hover:text-primary'"
        >
          Privacy policy
        </router-link>
      </nav>
    </div>
  </footer>
</template>
