<script setup lang="ts">
const config = useRuntimeConfig()
const sourceUrl = `${config.public.apiBase}/public-api/privacy`
const { data } = await useFetch<string>(sourceUrl, { responseType: 'text' })

useSeoMeta({
  title: 'Privacy Policy',
  description: 'Informativa privacy di MindCalm.',
})
</script>

<template>
  <section class="card">
    <h1>Privacy Policy</h1>
    <div v-if="data" v-html="data" />
    <p v-else>Contenuto non disponibile.</p>
  </section>
</template>
