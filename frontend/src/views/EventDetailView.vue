<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import ArticleCover from '../components/ArticleCover.vue'
import ArticleRenderer from '../components/ArticleRenderer.vue'

const route = useRoute()
const eventItem = ref<any>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const { data } = await axios.get(`/api/events/${route.params.slug}`)
    eventItem.value = data
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-container">
    <div v-if="loading" class="card p-6">Caricamento...</div>

    <div v-else-if="eventItem" class="max-w-3xl mx-auto">
      <ArticleCover
        :src="eventItem.coverImage"
        :alt="eventItem.title"
        container-class="aspect-video rounded-2xl overflow-hidden mb-6"
        image-class="h-full w-full object-cover"
      />

      <p class="text-sm text-text-secondary mb-2">
        {{ new Date(eventItem.startsAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) }}
        · {{ eventItem.city }}
        <span v-if="eventItem.venue"> · {{ eventItem.venue }}</span>
      </p>
      <h1 class="text-3xl font-bold text-text-primary mb-3">{{ eventItem.title }}</h1>
      <p class="text-sm text-text-secondary mb-6">Organizzato da {{ eventItem.organizer }}</p>

      <ArticleRenderer :html="eventItem.body" class="prose prose-slate max-w-none" />
    </div>
  </div>
</template>
