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
            ? 'Post pubblici, eventi e accesso riservato in un ambiente piu chiaro e leggibile.'
            : 'La tua area personale resta separata dai contenuti pubblici e dai documenti legali consultabili in ogni momento.' }}
        </p>
      </div>

      <nav aria-label="Collegamenti legali" class="flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end">
        <router-link
          to="/termini-e-condizioni"
          class="text-xs text-text-secondary transition-colors hover:text-text-primary"
          :class="{ 'text-text-primary': isActivePath('/termini-e-condizioni') }"
        >
          Termini e condizioni
        </router-link>
        <router-link
          to="/privacy-policy"
          class="text-xs text-text-secondary transition-colors hover:text-text-primary"
          :class="{ 'text-text-primary': isActivePath('/privacy-policy') }"
        >
          Privacy policy
        </router-link>
      </nav>
    </div>
  </footer>
</template>
