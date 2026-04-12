<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'

interface Category {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  sortOrder: number
  audioCount: number
}

const categories = ref<Category[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingId = ref<string | null>(null)
const error = ref('')

const form = ref({ name: '', description: '', color: '#4A90D9', icon: '' })

const icons = ['lotus', 'wind', 'body', 'moon', 'sun', 'brain', 'heart', 'star']

async function fetchCategories() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/admin/categories')
    categories.value = data
  } finally {
    loading.value = false
  }
}

function openNew() {
  editingId.value = null
  form.value = { name: '', description: '', color: '#4A90D9', icon: '' }
  error.value = ''
  showModal.value = true
}

function openEdit(cat: Category) {
  editingId.value = cat.id
  form.value = {
    name: cat.name,
    description: cat.description || '',
    color: cat.color || '#4A90D9',
    icon: cat.icon || '',
  }
  error.value = ''
  showModal.value = true
}

async function save() {
  error.value = ''
  try {
    if (editingId.value) {
      await axios.put(`/api/admin/categories/${editingId.value}`, form.value)
    } else {
      await axios.post('/api/admin/categories', form.value)
    }
    showModal.value = false
    await fetchCategories()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore nel salvataggio'
  }
}

async function deleteCategory(cat: Category) {
  if (!confirm(`Eliminare la categoria "${cat.name}"?`)) return
  try {
    await axios.delete(`/api/admin/categories/${cat.id}`)
    await fetchCategories()
  } catch (e: any) {
    alert(e.response?.data?.error || 'Errore')
  }
}

onMounted(fetchCategories)
</script>

<template>
  <div>
    <PageHeader
      title="Categorie"
      description="Organizza il catalogo con categorie, colori e metadati visuali."
    >
      <template #actions>
        <button @click="openNew" class="btn-primary">+ Nuova categoria</button>
      </template>
    </PageHeader>

    <div class="table-container">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Colore</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Nome</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Descrizione</th>
            <th class="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Audio</th>
            <th class="table-actions-header px-4 py-3 text-xs font-medium text-text-secondary uppercase">Azioni</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="c in categories" :key="c.id" class="hover:bg-gray-50/50">
            <td class="px-4 py-3">
              <div class="w-6 h-6 rounded-full" :style="{ backgroundColor: c.color || '#ccc' }"></div>
            </td>
            <td class="px-4 py-3 text-sm font-medium text-text-primary">{{ c.name }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ c.description || '-' }}</td>
            <td class="px-4 py-3 text-sm text-text-secondary">{{ c.audioCount }}</td>
            <td class="table-actions-cell">
              <div class="table-actions-group">
                <button
                  @click="openEdit(c)"
                  class="icon-action-button icon-action-button-neutral"
                  title="Modifica"
                  aria-label="Modifica"
                >
                  <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button
                  @click="deleteCategory(c)"
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
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="showModal = false">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <h2 class="text-lg font-bold text-text-primary mb-4">
            {{ editingId ? 'Modifica categoria' : 'Nuova categoria' }}
          </h2>

          <form @submit.prevent="save" class="space-y-4">
            <div v-if="error" class="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{{ error }}</div>

            <div>
              <label class="label">Nome *</label>
              <input v-model="form.name" type="text" required class="input-field" />
            </div>

            <div>
              <label class="label">Descrizione</label>
              <textarea v-model="form.description" rows="2" class="input-field"></textarea>
            </div>

            <div>
              <label class="label">Colore</label>
              <div class="flex items-center gap-2">
                <input v-model="form.color" type="color" class="w-10 h-10 rounded cursor-pointer" />
                <input v-model="form.color" type="text" class="input-field flex-1" placeholder="#4A90D9" />
              </div>
            </div>

            <div>
              <label class="label">Icona</label>
              <div class="flex gap-2 flex-wrap">
                <button
                  v-for="icon in icons"
                  :key="icon"
                  type="button"
                  @click="form.icon = icon"
                  :class="[
                    'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    form.icon === icon ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-text-secondary hover:border-gray-300'
                  ]"
                >
                  {{ icon }}
                </button>
              </div>
            </div>

            <div class="flex gap-3 pt-2">
              <button type="submit" class="btn-primary">Salva</button>
              <button type="button" @click="showModal = false" class="btn-secondary">Annulla</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
