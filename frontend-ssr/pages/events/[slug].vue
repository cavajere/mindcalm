<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))

const event = await fetchEventDetail(slug.value)

useSeoMeta({
  title: event?.title || 'Evento',
  description: event?.excerpt || 'Dettaglio evento MindCalm',
})
</script>

<template>
  <article v-if="event" class="card">
    <h1>{{ event.title }}</h1>
    <p>{{ event.excerpt }}</p>
    <p v-if="event.city">{{ event.city }}<span v-if="event.venue"> · {{ event.venue }}</span></p>
    <p v-if="event.startsAt">Data: {{ event.startsAt }}</p>
    <div v-if="event.body" v-html="event.body" />
  </article>
</template>
