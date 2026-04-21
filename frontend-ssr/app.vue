<script setup lang="ts">
const runtimeConfig = useRuntimeConfig()
const allowIndexing = runtimeConfig.public.allowIndexing !== false

useHead({
  titleTemplate: (titleChunk?: string) =>
    titleChunk && titleChunk !== 'MindCalm' ? `${titleChunk} · MindCalm` : 'MindCalm',
  meta: allowIndexing
    ? []
    : [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <NuxtLink to="/" class="brand">MindCalm</NuxtLink>
      <nav class="nav">
        <NuxtLink to="/audio">Audio</NuxtLink>
        <NuxtLink to="/posts">Articoli</NuxtLink>
        <NuxtLink to="/events">Eventi</NuxtLink>
      </nav>
    </header>

    <main class="container">
      <NuxtPage />
    </main>

    <footer class="footer">
      <NuxtLink to="/privacy-policy">Privacy Policy</NuxtLink>
      <NuxtLink to="/termini-e-condizioni">Termini e condizioni</NuxtLink>
    </footer>
  </div>
</template>
