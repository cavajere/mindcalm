<script setup lang="ts">
const tabs = [
  { to: '/settings/legal/privacy', label: 'Privacy & Consensi' },
  { to: '/settings/legal/terms', label: 'Terms & Conditions' },
]
</script>

<template>
  <nav class="mb-6 flex flex-wrap gap-2">
    <router-link
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
      :class="$route.path === tab.to
        ? 'border-slate-950 bg-slate-950 text-white'
        : 'border-ui-border bg-surface text-text-secondary hover:border-slate-300 hover:text-text-primary'"
    >
      {{ tab.label }}
    </router-link>
  </nav>
</template>
