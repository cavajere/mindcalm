<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import TiptapEditor from '../components/TiptapEditor.vue'
import TagSelector, { type SelectableTag } from '../components/TagSelector.vue'

type ExistingFileMeta = {
  url: string
  originalName: string
  displayName: string
}

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
const existingCover = ref<ExistingFileMeta | null>(null)
const coverImageDisplayName = ref('')
const removeExistingCover = ref(false)

function handleCoverChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) {
    coverImage.value = files[0]
    coverPreview.value = URL.createObjectURL(files[0])
    coverImageDisplayName.value = files[0].name
    removeExistingCover.value = false
  }
}

function removeCover() {
  if (coverImage.value && existingCover.value?.url) {
    coverImage.value = null
    coverPreview.value = ''
    coverImageDisplayName.value = existingCover.value.displayName
    removeExistingCover.value = false
    return
  }

  coverImage.value = null
  coverPreview.value = ''
  coverImageDisplayName.value = ''
  if (existingCover.value?.url) {
    removeExistingCover.value = true
  }
  existingCover.value = null
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
    fd.append('coverImageDisplayName', coverImageDisplayName.value)

    if (coverImage.value) fd.append('coverImage', coverImage.value)
    if (removeExistingCover.value) fd.append('removeCoverImage', 'true')

    if (isEdit.value) {
      await axios.put(`/api/admin/articles/${route.params.id}`, fd)
    } else {
      await axios.post('/api/admin/articles', fd)
    }

    router.push('/articles')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore nel salvataggio'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const { data: tagsData } = await axios.get('/api/admin/tags')
  tags.value = tagsData

  if (isEdit.value) {
    loading.value = true
    try {
      const { data: article } = await axios.get(`/api/admin/articles/${route.params.id}`)
      form.value = {
        title: article.title,
        author: article.author,
        excerpt: article.excerpt || '',
        body: article.body,
        status: article.status,
        tagIds: (article.tags || []).map((tag: any) => tag.id),
      }
      existingCover.value = article.coverImage
        ? {
            url: article.coverImage,
            originalName: article.coverImageOriginalName || '',
            displayName: article.coverImageDisplayName || '',
          }
        : null
      coverImageDisplayName.value = article.coverImageDisplayName || ''
      removeExistingCover.value = false
    } finally {
      loading.value = false
    }
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl">
    <PageHeader
      :title="isEdit ? 'Modifica articolo' : 'Nuovo articolo'"
      :description="isEdit ? 'Aggiorna contenuto, metadata e stato editoriale.' : 'Crea un nuovo articolo con contenuto, autore e metadata.'"
    >
      <template #actions>
        <button type="button" @click="router.push('/articles')" class="btn-secondary">Annulla</button>
      </template>
    </PageHeader>

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
        <img v-else-if="existingCover?.url" :src="existingCover.url" class="mt-2 h-32 rounded-lg object-cover" />
        <div v-if="coverImage || existingCover" class="mt-3 space-y-3">
          <div>
            <label class="label">Nome file visualizzato</label>
            <input v-model="coverImageDisplayName" type="text" class="input-field" />
            <p class="text-xs text-text-secondary mt-1">
              Originale: {{ coverImage?.name || existingCover?.originalName }}. L'estensione viene mantenuta automaticamente.
            </p>
          </div>
          <button type="button" @click="removeCover" class="text-sm text-red-500 hover:underline">
            Rimuovi immagine
          </button>
        </div>
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
