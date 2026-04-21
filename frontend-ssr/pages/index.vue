<script setup lang="ts">
const [posts, audioItems, events] = await Promise.all([
  fetchPostList(),
  fetchAudioList(),
  fetchEventList(),
])

const latestPosts = posts.slice(0, 3)
const latestAudio = audioItems.slice(0, 3)
const upcomingEvents = events.slice(0, 3)

useSeoMeta({
  title: 'MindCalm',
  description: 'Sessioni audio, articoli ed eventi di mindfulness guidata.',
  ogTitle: 'MindCalm',
  ogDescription: 'Sessioni audio, articoli ed eventi di mindfulness guidata.',
})
</script>

<template>
  <section>
    <h1>MindCalm</h1>
    <p>Mindfulness guidata con audio, articoli ed eventi.</p>

    <h2>Ultimi articoli</h2>
    <ul>
      <li v-for="post in latestPosts" :key="post.id">
        <NuxtLink :to="`/posts/${post.slug}`">{{ post.title }}</NuxtLink>
      </li>
    </ul>

    <h2>Audio recenti</h2>
    <ul>
      <li v-for="item in latestAudio" :key="item.id">
        <NuxtLink :to="`/audio/${item.id}`">{{ item.title }}</NuxtLink>
      </li>
    </ul>

    <h2>Prossimi eventi</h2>
    <ul>
      <li v-for="event in upcomingEvents" :key="event.id">
        <NuxtLink :to="`/events/${event.slug}`">{{ event.title }}</NuxtLink>
      </li>
    </ul>
  </section>
</template>
