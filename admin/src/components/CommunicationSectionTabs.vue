<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = computed(() => ([
  { to: '/communications', label: 'Overview', exact: true },
  { to: '/communications/campaigns', label: 'Campagne' },
  { to: '/communications/contacts', label: 'Contatti' },
  { to: '/communications/consents', label: 'Consensi' },
  { to: '/communications/suppressions', label: 'Suppressions' },
  { to: '/settings/legal/privacy', label: 'Impostazioni iscrizione' },
]))

function isActive(path: string, exact = false) {
  if (exact) {
    return route.path === path
  }

  return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <div class="mb-6 overflow-x-auto">
    <div class="inline-flex min-w-full gap-2 rounded-2xl border border-ui-border bg-white p-2">
      <router-link
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        :class="[
          'whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
          isActive(tab.to, tab.exact)
            ? 'bg-slate-950 text-white'
            : 'text-text-secondary hover:bg-slate-100 hover:text-text-primary',
        ]"
      >
        {{ tab.label }}
      </router-link>
    </div>
  </div>
</template>
