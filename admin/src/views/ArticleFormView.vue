<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import TiptapEditor from '../components/TiptapEditor.vue'
import TagSelector, { type SelectableTag } from '../components/TagSelector.vue'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const tags = ref<SelectableTag[]>([])

const form = ref({
  title: '',
  author: '',
  excerpt: '',
  body: '',
  status: 'DRAFT',
  tagIds: [] as string[],
})

const coverImage = ref<File | null>(null)
const coverPreview = ref('')
const existingCover = ref('')

function handleCoverChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) {
    coverImage.value = files[0]
    coverPreview.value = URL.createObjectURL(files[0])
  }
}

async function save() {
  error.value = ''
  saving.value = true

  try {
    const fd = new FormData()
    fd.append('title', form.value.title)
    fd.append('author', form.value.author)
    fd.append('excerpt', form.value.excerpt)
    fd.append('body', form.value.body)
    fd.append('status', form.value.status)
    fd.append('tagIds', JSON.stringify(form.value.tagIds))

    if (coverImage.value) fd.append('coverImage', coverImage.value)

    if (isEdit.value) {
      await axios.put(`/api/v1/admin/articles/${route.params.id}`, fd)
    } else {
      await axios.post('/api/v1/admin/articles', fd)
    }

    router.push('/articles')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore nel salvataggio'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const { data: tagsData } = await axios.get('/api/v1/admin/tags')
  tags.value = tagsData

  if (isEdit.value) {
    loading.value = true
    try {
      const { data: articlesData } = await axios.get('/api/v1/admin/articles?limit=100')
      const article = articlesData.data.find((a: any) => a.id === route.params.id)
      if (article) {
        form.value = {
          title: article.title,
          author: article.author,
          excerpt: article.excerpt || '',
          body: article.body,
          status: article.status,
          tagIds: (article.tags || []).map((tag: any) => tag.id),
        }
        existingCover.value = article.coverImage || ''
      }
    } finally {
      loading.value = false
    }
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl">
    <div class="flex items-center gap-4 mb-6">
      <button @click="router.push('/articles')" class="text-text-secondary hover:text-text-primary">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="text-2xl font-bold text-text-primary">{{ isEdit ? 'Modifica articolo' : 'Nuovo articolo' }}</h1>
    </div>

    <form @submit.prevent="save" class="card w-full space-y-5">
      <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{{ error }}</div>

      <div>
        <label class="label">Titolo *</label>
        <input v-model="form.title" type="text" required class="input-field" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Autore *</label>
          <input v-model="form.author" type="text" required class="input-field" />
        </div>
        <div>
          <label class="label">Stato</label>
          <select v-model="form.status" class="input-field">
            <option value="DRAFT">Bozza</option>
            <option value="PUBLISHED">Pubblicato</option>
          </select>
        </div>
      </div>

      <div>
        <label class="label">Estratto (max 300 caratteri)</label>
        <textarea v-model="form.excerpt" rows="2" maxlength="300" class="input-field"></textarea>
        <p class="text-xs text-text-secondary mt-1">{{ form.excerpt.length }}/300</p>
      </div>

      <div>
        <label class="label">Contenuto *</label>
        <TiptapEditor v-model="form.body" />
      </div>

      <div>
        <label class="label">Tag</label>
        <TagSelector v-model="form.tagIds" :tags="tags" />
      </div>

      <div>
        <label class="label">Immagine copertina</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleCoverChange" class="input-field" />
        <img v-if="coverPreview" :src="coverPreview" class="mt-2 h-32 rounded-lg object-cover" />
        <img v-else-if="existingCover" :src="existingCover" class="mt-2 h-32 rounded-lg object-cover" />
      </div>

      <div class="flex gap-3 pt-2">
        <button type="submit" :disabled="saving" class="btn-primary">
          {{ saving ? 'Salvataggio...' : 'Salva' }}
        </button>
        <button type="button" @click="router.push('/articles')" class="btn-secondary">Annulla</button>
      </div>
    </form>
  </div>
</template>
