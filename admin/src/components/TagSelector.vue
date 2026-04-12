<script setup lang="ts">
import { computed, ref } from 'vue'

export interface SelectableTag {
  id: string
  label: string
  slug: string
  isActive?: boolean
}

const props = defineProps<{
  tags: SelectableTag[]
  modelValue: string[]
  max?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const query = ref('')
const maxTags = computed(() => props.max ?? 10)
const selectedSet = computed(() => new Set(props.modelValue))
const selectedTags = computed(() => props.tags.filter(tag => selectedSet.value.has(tag.id)))
const filteredTags = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  if (!normalized) return props.tags

  return props.tags.filter(tag =>
    tag.label.toLowerCase().includes(normalized) ||
    tag.slug.toLowerCase().includes(normalized),
  )
})

function toggle(tagId: string) {
  const next = new Set(props.modelValue)
  if (next.has(tagId)) {
    next.delete(tagId)
  } else if (next.size < maxTags.value) {
    next.add(tagId)
  }

  emit('update:modelValue', [...next])
}

function remove(tagId: string) {
  emit('update:modelValue', props.modelValue.filter(id => id !== tagId))
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-medium text-text-primary">Tag selezionati</p>
      <p class="text-xs text-text-secondary">{{ modelValue.length }}/{{ maxTags }}</p>
    </div>

    <div class="min-h-[52px] rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
      <div v-if="selectedTags.length" class="flex flex-wrap gap-2">
        <button
          v-for="tag in selectedTags"
          :key="tag.id"
          type="button"
          class="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white"
          @click="remove(tag.id)"
        >
          {{ tag.label }}
          <span class="text-white/80">×</span>
        </button>
      </div>
      <p v-else class="text-sm text-text-secondary">Nessun tag selezionato</p>
    </div>

    <div>
      <input
        v-model="query"
        type="text"
        placeholder="Cerca tag..."
        class="input-field"
      />
    </div>

    <div class="max-h-48 overflow-y-auto rounded-xl border border-gray-200">
      <button
        v-for="tag in filteredTags"
        :key="tag.id"
        type="button"
        class="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-gray-50"
        @click="toggle(tag.id)"
      >
        <div>
          <p class="font-medium text-text-primary">{{ tag.label }}</p>
          <p class="text-xs text-text-secondary">{{ tag.slug }}</p>
        </div>
        <span
          :class="[
            'rounded-full px-2.5 py-1 text-[11px] font-semibold',
            selectedSet.has(tag.id)
              ? 'bg-primary text-white'
              : tag.isActive === false
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-text-secondary'
          ]"
        >
          {{ selectedSet.has(tag.id) ? 'Selezionato' : tag.isActive === false ? 'Inattivo' : 'Disponibile' }}
        </span>
      </button>
      <div v-if="!filteredTags.length" class="px-4 py-6 text-sm text-text-secondary">
        Nessun tag trovato
      </div>
    </div>
  </div>
</template>
