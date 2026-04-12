<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'

const stats = ref({ audio: { published: 0, draft: 0 }, articles: { published: 0, draft: 0 }, categories: 0 })
const recentAudio = ref<any[]>([])
const recentArticles = ref<any[]>([])

onMounted(async () => {
  try {
    const [audioRes, articlesRes, categoriesRes] = await Promise.all([
      axios.get('/api/admin/audio?limit=5'),
      axios.get('/api/admin/articles?limit=5'),
      axios.get('/api/admin/categories'),
    ])

    recentAudio.value = audioRes.data.data
    recentArticles.value = articlesRes.data.data

    const allAudio = audioRes.data.pagination.total
    const pubAudioRes = await axios.get('/api/admin/audio?status=PUBLISHED&limit=1')
    stats.value.audio.published = pubAudioRes.data.pagination.total
    stats.value.audio.draft = allAudio - stats.value.audio.published

    const allArticles = articlesRes.data.pagination.total
    const pubArticlesRes = await axios.get('/api/admin/articles?status=PUBLISHED&limit=1')
    stats.value.articles.published = pubArticlesRes.data.pagination.total
    stats.value.articles.draft = allArticles - stats.value.articles.published

    stats.value.categories = categoriesRes.data.length
  } catch {}
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-text-primary mb-6">Dashboard</h1>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div class="card">
        <p class="text-sm text-text-secondary mb-1">Audio</p>
        <p class="text-3xl font-bold text-text-primary">{{ stats.audio.published + stats.audio.draft }}</p>
        <p class="text-xs text-text-secondary mt-1">{{ stats.audio.published }} pubblicati, {{ stats.audio.draft }} bozze</p>
      </div>
      <div class="card">
        <p class="text-sm text-text-secondary mb-1">Articoli</p>
        <p class="text-3xl font-bold text-text-primary">{{ stats.articles.published + stats.articles.draft }}</p>
        <p class="text-xs text-text-secondary mt-1">{{ stats.articles.published }} pubblicati, {{ stats.articles.draft }} bozze</p>
      </div>
      <div class="card">
        <p class="text-sm text-text-secondary mb-1">Categorie</p>
        <p class="text-3xl font-bold text-text-primary">{{ stats.categories }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Recent audio -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-text-primary">Ultimi audio</h2>
          <router-link to="/audio" class="text-sm text-primary hover:underline">Vedi tutti</router-link>
        </div>
        <div class="space-y-3">
          <div v-for="audio in recentAudio" :key="audio.id" class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div>
              <p class="text-sm font-medium text-text-primary">{{ audio.title }}</p>
              <p class="text-xs text-text-secondary">{{ audio.category?.name }}</p>
            </div>
            <span :class="['text-xs px-2 py-1 rounded-full', audio.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700']">
              {{ audio.status === 'PUBLISHED' ? 'Pubblicato' : 'Bozza' }}
            </span>
          </div>
          <p v-if="!recentAudio.length" class="text-sm text-text-secondary">Nessun audio</p>
        </div>
      </div>

      <!-- Recent articles -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-text-primary">Ultimi articoli</h2>
          <router-link to="/articles" class="text-sm text-primary hover:underline">Vedi tutti</router-link>
        </div>
        <div class="space-y-3">
          <div v-for="a in recentArticles" :key="a.id" class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div>
              <p class="text-sm font-medium text-text-primary">{{ a.title }}</p>
              <p class="text-xs text-text-secondary">{{ a.author }}</p>
            </div>
            <span :class="['text-xs px-2 py-1 rounded-full', a.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700']">
              {{ a.status === 'PUBLISHED' ? 'Pubblicato' : 'Bozza' }}
            </span>
          </div>
          <p v-if="!recentArticles.length" class="text-sm text-text-secondary">Nessun articolo</p>
        </div>
      </div>
    </div>
  </div>
</template>
