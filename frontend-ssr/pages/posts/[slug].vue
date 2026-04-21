<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))

const post = await fetchPostDetail(slug.value)

useSeoMeta({
  title: post?.title || 'Articolo',
  description: post?.excerpt || 'Dettaglio articolo MindCalm',
  ogType: 'article',
})

useHead({
  script: post
    ? [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt || undefined,
      }),
    }]
    : [],
})
</script>

<template>
  <article v-if="post" class="card">
    <h1>{{ post.title }}</h1>
    <p>{{ post.excerpt }}</p>
    <div v-if="post.body" v-html="post.body" />
  </article>
</template>
