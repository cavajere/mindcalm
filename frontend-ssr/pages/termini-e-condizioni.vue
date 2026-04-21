<script setup lang="ts">
const config = useRuntimeConfig()
const sourceUrl = `${config.public.apiBase}/public-api/terms`
const { data } = await useFetch<string>(sourceUrl, { responseType: 'text' })

useSeoDefaults({
  title: 'Termini e condizioni',
  description: 'Termini e condizioni di MindCalm.',
})
</script>

<template>
  <section class="card">
    <h1>Termini e condizioni</h1>
    <div v-if="data" v-html="data" />
    <p v-else>Contenuto non disponibile.</p>
  </section>
</template>
