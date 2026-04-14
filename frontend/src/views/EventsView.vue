<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'
import ArticleCover from '../components/ArticleCover.vue'

interface EventItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
  organizer: string
  city: string
  venue: string | null
  startsAt: string
  coverImage: string | null
}

const events = ref<EventItem[]>([])
const loading = ref(true)

async function fetchEvents() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/events?limit=50')
    events.value = data.data
  } finally {
    loading.value = false
  }
}

onMounted(fetchEvents)
</script>

<template>
  <div class="page-container">
    <h1 class="text-3xl font-bold text-text-primary mb-8">Eventi</h1>

    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 6" :key="i" class="card animate-pulse">
        <div class="aspect-video bg-gray-200"></div>
        <div class="p-4">
          <div class="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
          <div class="h-3 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    </div>

    <div v-else-if="events.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <router-link
        v-for="eventItem in events"
        :key="eventItem.id"
        :to="`/events/${eventItem.slug}`"
        class="card overflow-hidden hover:scale-[1.01] transition-transform"
      >
        <ArticleCover
          :src="eventItem.coverImage"
          :alt="eventItem.title"
          container-class="aspect-video"
          image-class="h-full w-full object-cover"
        />
        <div class="p-5">
          <p class="text-xs text-text-secondary mb-2">
            {{ new Date(eventItem.startsAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) }}
            · {{ eventItem.city }}
          </p>
          <h3 class="font-semibold text-text-primary mb-2 line-clamp-2">{{ eventItem.title }}</h3>
          <p v-if="eventItem.excerpt" class="text-sm text-text-secondary line-clamp-3">{{ eventItem.excerpt }}</p>
        </div>
      </router-link>
    </div>

    <div v-else class="text-center py-16">
      <p class="text-text-secondary text-lg">Nessun evento registrato</p>
    </div>
  </div>
</template>
