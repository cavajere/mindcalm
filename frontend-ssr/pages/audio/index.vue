<script setup lang="ts">
const audioItems = await fetchAudioList()

useSeoMeta({
  title: 'Sessioni audio',
  description: 'Meditazioni guidate e percorsi audio MindCalm.',
})
</script>

<template>
  <section>
    <h1>Audio</h1>
    <article v-for="item in audioItems" :key="item.id" class="card">
      <h2>
        <NuxtLink :to="`/audio/${item.id}`">{{ item.title }}</NuxtLink>
      </h2>
      <p>{{ item.description }}</p>
    </article>
    <p v-if="!audioItems.length">Nessuna sessione audio disponibile.</p>
  </section>
</template>
