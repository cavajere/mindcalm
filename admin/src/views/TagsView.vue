<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'

interface Tag {
  id: string
  label: string
  slug: string
  description: string | null
  isActive: boolean
  sortOrder: number
  aliases: string[]
  audioCount: number
  articleCount: number
}

const tags = ref<Tag[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingId = ref<string | null>(null)
const error = ref('')
const search = ref('')

const form = ref({
  label: '',
  description: '',
  aliases: '',
  isActive: true,
  sortOrder: 0,
})

const filteredTags = computed(() => {
  const normalized = search.value.trim().toLowerCase()
  if (!normalized) return tags.value

  return tags.value.filter(tag =>
    tag.label.toLowerCase().includes(normalized) ||
    tag.slug.toLowerCase().includes(normalized) ||
    tag.aliases.some(alias => alias.toLowerCase().includes(normalized)),
  )
})

async function fetchTags() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/admin/tags')
    tags.value = data
  } finally {
    loading.value = false
  }
}

function openNew() {
  editingId.value = null
  error.value = ''
  form.value = {
    label: '',
    description: '',
    aliases: '',
    isActive: true,
    sortOrder: 0,
  }
  showModal.value = true
}

function openEdit(tag: Tag) {
  editingId.value = tag.id
  error.value = ''
  form.value = {
    label: tag.label,
    description: tag.description || '',
    aliases: tag.aliases.join(', '),
    isActive: tag.isActive,
    sortOrder: tag.sortOrder,
  }
  showModal.value = true
}

async function save() {
  error.value = ''
  const payload = {
    label: form.value.label,
    description: form.value.description,
    aliases: form.value.aliases
      .split(',')
      .map(alias => alias.trim())
      .filter(Boolean),
    isActive: form.value.isActive,
    sortOrder: Number(form.value.sortOrder) || 0,
  }

  try {
    if (editingId.value) {
      await axios.put(`/api/admin/tags/${editingId.value}`, payload)
    } else {
      await axios.post('/api/admin/tags', payload)
    }

    showModal.value = false
    await fetchTags()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Errore nel salvataggio'
  }
}

async function toggleStatus(tag: Tag) {
  await axios.patch(`/api/admin/tags/${tag.id}/status`, { isActive: !tag.isActive })
  tag.isActive = !tag.isActive
}

async function deleteTag(tag: Tag) {
  if (!confirm(`Eliminare il tag "${tag.label}"?`)) return
  await axios.delete(`/api/admin/tags/${tag.id}`)
  await fetchTags()
}

onMounted(fetchTags)
</script>

<template>
  <div>
    <PageHeader
      title="Tag"
      description="Tassonomia condivisa per audio e articoli."
    >
      <template #actions>
        <button @click="openNew" class="btn-primary">+ Nuovo tag</button>
      </template>
    </PageHeader>

    <div class="mb-4">
      <input v-model="search" type="text" placeholder="Cerca per nome, slug o alias..." class="input-field max-w-md" />
    </div>

    <div class="table-container">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Tag</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Alias</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Uso</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Stato</th>
            <th class="table-actions-header px-4 py-3 text-xs font-medium uppercase text-text-secondary">Azioni</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="tag in filteredTags" :key="tag.id" class="hover:bg-gray-50/50">
            <td class="px-4 py-3">
              <div>
                <p class="text-sm font-semibold text-text-primary">{{ tag.label }}</p>
                <p class="text-xs font-mono text-text-secondary">{{ tag.slug }}</p>
                <p v-if="tag.description" class="mt-1 text-sm text-text-secondary">{{ tag.description }}</p>
              </div>
            </td>
            <td class="px-4 py-3">
              <div v-if="tag.aliases.length" class="flex flex-wrap gap-2">
                <span
                  v-for="alias in tag.aliases"
                  :key="alias"
                  class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                >
                  {{ alias }}
                </span>
              </div>
              <span v-else class="text-sm text-text-secondary">-</span>
            </td>
            <td class="px-4 py-3 text-sm text-text-secondary">
              {{ tag.audioCount }} audio · {{ tag.articleCount }} articoli
            </td>
            <td class="px-4 py-3">
              <button
                type="button"
                class="rounded-full px-3 py-1 text-xs font-semibold"
                :class="tag.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
                @click="toggleStatus(tag)"
              >
                {{ tag.isActive ? 'Attivo' : 'Inattivo' }}
              </button>
            </td>
            <td class="table-actions-cell">
              <div class="table-actions-group">
                <button
                  @click="openEdit(tag)"
                  class="icon-action-button icon-action-button-neutral"
                  title="Modifica"
                  aria-label="Modifica"
                >
                  <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button
                  @click="deleteTag(tag)"
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
          <tr v-if="!filteredTags.length && !loading">
            <td colspan="5" class="px-4 py-8 text-center text-text-secondary">Nessun tag</td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="showModal = false">
        <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-lg font-bold text-text-primary">{{ editingId ? 'Modifica tag' : 'Nuovo tag' }}</h2>

          <form @submit.prevent="save" class="space-y-4">
            <div v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{{ error }}</div>

            <div>
              <label class="label">Nome *</label>
              <input v-model="form.label" type="text" required maxlength="50" class="input-field" />
            </div>

            <div>
              <label class="label">Descrizione</label>
              <textarea v-model="form.description" rows="2" maxlength="200" class="input-field"></textarea>
            </div>

            <div>
              <label class="label">Alias</label>
              <input v-model="form.aliases" type="text" class="input-field" placeholder="ansia, stress, agitazione" />
              <p class="mt-1 text-xs text-text-secondary">Separa gli alias con virgole</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Ordinamento</label>
                <input v-model="form.sortOrder" type="number" min="0" class="input-field" />
              </div>
              <div class="flex items-end">
                <label class="flex items-center gap-2 text-sm text-text-primary">
                  <input v-model="form.isActive" type="checkbox" class="rounded border-gray-300 text-primary focus:ring-primary/30" />
                  Tag attivo
                </label>
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
