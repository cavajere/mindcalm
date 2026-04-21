<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id || ''))

const audio = await fetchAudioDetail(id.value)

useSeoDefaults({
  title: audio?.title || 'Sessione audio',
  description: audio?.description || 'Dettaglio sessione audio MindCalm',
  coverImagePath: audio?.coverImage ?? null,
})
</script>

<template>
  <article v-if="audio" class="card">
    <h1>{{ audio.title }}</h1>
    <p>{{ audio.description }}</p>
    <p v-if="audio.durationSec">Durata: {{ audio.durationSec }}s</p>
  </article>
</template>
