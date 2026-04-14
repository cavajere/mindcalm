<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { getPublicAppUrl } from '../utils/appUrls'

const router = useRouter()
const articles = ref<any[]>([])
const loading = ref(true)

async function fetchArticles() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/admin/articles?limit=50')
    articles.value = data.data
  } finally {
    loading.value = false
  }
}

async function toggleStatus(article: any) {
  const newStatus = article.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
  await axios.patch(`/api/admin/articles/${article.id}/status`, {
    status: newStatus,
    publicBaseUrl: getPublicAppUrl(),
  })
  article.status = newStatus
}

async function deleteArticle(article: any) {
  if (!confirm(`Eliminare l'articolo "${article.title}"?`)) return
  await axios.delete(`/api/admin/articles/${article.id}`)
  articles.value = articles.value.filter(a => a.id !== article.id)
}

onMounted(fetchArticles)
</script>

<template>
  <div>
    <PageHeader
      title="Articoli"
      description="Gestisci articoli, stato editoriale e routing pubblico."
    >
      <template #actions>
        <router-link to="/articles/new" class="btn-primary">+ Nuovo articolo</router-link>
      </template>
    </PageHeader>

    <div class="table-container">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Titolo</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Autore</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Slug</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Stato</th>
            <th class="table-actions-header px-4 py-3 text-xs font-medium text-text-secondary uppercase">Azioni</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="a in articles" :key="a.id" class="hover:bg-gray-50/50">
            <td class="px-4 py-3 text-sm font-medium text-text-primary">{{ a.title }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ a.author }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary font-mono">{{ a.slug }}</td>
            <td class="px-4 py-3">
              <StatusBadge :status="a.status" @click="toggleStatus(a)" class="cursor-pointer" />
            </td>
            <td class="table-actions-cell">
              <div class="table-actions-group">
                <button
                  @click="router.push(`/articles/${a.id}/edit`)"
                  class="icon-action-button icon-action-button-neutral"
                  title="Modifica"
                  aria-label="Modifica"
                >
                  <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button
                  @click="deleteArticle(a)"
                  class="icon-action-button icon-action-button-danger"
                  title="Elimina"
                  aria-label="Elimina"
                >
                  <svg class="w-4 h-4 text-red-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!articles.length && !loading">
            <td colspan="5" class="px-4 py-8 text-center text-text-secondary">Nessun articolo</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
