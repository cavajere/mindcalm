<script setup lang="ts">
const events = await fetchEventList()

useSeoMeta({
  title: 'Eventi mindfulness',
  description: 'Calendario eventi e incontri MindCalm.',
})
</script>

<template>
  <section>
    <h1>Eventi</h1>
    <article v-for="event in events" :key="event.id" class="card">
      <h2>
        <NuxtLink :to="`/events/${event.slug}`">{{ event.title }}</NuxtLink>
      </h2>
      <p>{{ event.excerpt }}</p>
      <small v-if="event.startsAt">{{ event.startsAt }}</small>
    </article>
    <p v-if="!events.length">Nessun evento disponibile.</p>
  </section>
</template>
