<script setup lang="ts">
const config = useRuntimeConfig()
const sourceUrl = `${config.public.apiBase}/public-api/privacy`
const headers: Record<string, string> = {}
if (import.meta.server && config.ssrInternalToken) {
  headers['x-internal-ssr-token'] = String(config.ssrInternalToken)
}
const { data } = await useFetch<string>(sourceUrl, { responseType: 'text', headers })
const sanitized = computed(() => sanitizeContentHtml(data.value))

useSeoDefaults({
  title: 'Privacy Policy',
  description: 'Informativa privacy di MindCalm.',
})
</script>

<template>
  <section class="card">
    <h1>Privacy Policy</h1>
    <div v-if="sanitized" v-html="sanitized" />
    <p v-else>Contenuto non disponibile.</p>
  </section>
</template>
