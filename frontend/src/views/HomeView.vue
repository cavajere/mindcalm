<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import AudioCard from '../components/AudioCard.vue'
import ArticleCover from '../components/ArticleCover.vue'
import axios from 'axios'

const store = useAudioStore()
const latestArticles = ref<any[]>([])
const featuredAudio = ref<any>(null)

onMounted(async () => {
  await store.fetchCategories()
  await store.fetchAudio()

  // Audio in evidenza (casuale tra i pubblicati)
  if (store.audioItems.length > 0) {
    featuredAudio.value = store.audioItems[Math.floor(Math.random() * store.audioItems.length)]
  }

  // Ultimi 3 articoli
  try {
    const { data } = await axios.get('/api/v1/articles?limit=3')
    latestArticles.value = data.data
  } catch {}
})
</script>

<template>
  <div class="page-container">
    <!-- Hero -->
    <section v-if="featuredAudio" class="mb-12">
      <div class="card overflow-hidden">
        <div class="relative bg-gradient-to-br from-primary/10 to-secondary/10 p-8 sm:p-12">
          <div class="max-w-lg">
            <p class="text-sm font-medium text-primary mb-2">Audio del giorno</p>
            <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-4">{{ featuredAudio.title }}</h1>
            <p class="text-text-secondary mb-6 line-clamp-2">{{ featuredAudio.description }}</p>
            <router-link :to="`/audio/${featuredAudio.id}`" class="btn-primary inline-flex items-center gap-2">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
              </svg>
              Ascolta ora
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Categorie -->
    <section v-if="store.categories.length" class="mb-12">
      <h2 class="text-2xl font-bold text-text-primary mb-6">Esplora per categoria</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <router-link
          v-for="cat in store.categories"
          :key="cat.id"
          :to="`/audio?category=${cat.id}`"
          class="card p-4 text-center hover:scale-[1.02] transition-transform"
        >
          <div
            class="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-xl"
            :style="{ backgroundColor: cat.color || '#4A90D9' }"
          >
            {{ cat.icon === 'lotus' ? '🧘' : cat.icon === 'wind' ? '🌬️' : cat.icon === 'body' ? '🫁' : cat.icon === 'moon' ? '🌙' : '☀️' }}
          </div>
          <p class="font-medium text-sm text-text-primary">{{ cat.name }}</p>
          <p class="text-xs text-text-secondary mt-1">{{ cat.audioCount }} audio</p>
        </router-link>
      </div>
    </section>

    <!-- Audio recenti -->
    <section v-if="store.audioItems.length" class="mb-12">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-text-primary">Audio recenti</h2>
        <router-link to="/audio" class="text-sm font-medium text-primary hover:underline">Vedi tutti</router-link>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <AudioCard v-for="audio in store.audioItems.slice(0, 6)" :key="audio.id" :audio="audio" />
      </div>
    </section>

    <!-- Ultimi articoli -->
    <section v-if="latestArticles.length" class="mb-12">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-text-primary">Dal blog</h2>
        <router-link to="/articles" class="text-sm font-medium text-primary hover:underline">Tutti gli articoli</router-link>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <router-link
          v-for="a in latestArticles"
          :key="a.id"
          :to="`/articles/${a.slug}`"
          class="card overflow-hidden hover:scale-[1.01] transition-transform"
        >
          <ArticleCover
            :src="a.coverImage"
            :alt="a.title"
            container-class="aspect-video"
            image-class="h-full w-full object-cover"
          />
          <div class="p-4">
            <p class="text-xs text-text-secondary mb-1">{{ new Date(a.publishedAt).toLocaleDateString('it-IT') }}</p>
            <h3 class="font-semibold text-text-primary mb-2 line-clamp-2">{{ a.title }}</h3>
            <p v-if="a.excerpt" class="text-sm text-text-secondary line-clamp-2">{{ a.excerpt }}</p>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>
