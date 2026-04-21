<script setup lang="ts">
const posts = await fetchPostList()

useSeoMeta({
  title: 'Articoli mindfulness',
  description: 'Approfondimenti e guide pratiche di mindfulness.',
})
</script>

<template>
  <section>
    <h1>Articoli</h1>
    <article v-for="post in posts" :key="post.id" class="card">
      <h2>
        <NuxtLink :to="`/posts/${post.slug}`">{{ post.title }}</NuxtLink>
      </h2>
      <p>{{ post.excerpt }}</p>
    </article>
    <p v-if="!posts.length">Nessun articolo disponibile.</p>
  </section>
</template>
