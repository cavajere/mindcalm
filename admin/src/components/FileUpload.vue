<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  accept: string
  label: string
}>()

const emit = defineEmits<{
  change: [file: File]
}>()

const fileName = ref('')

function handleChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) {
    fileName.value = files[0].name
    emit('change', files[0])
  }
}
</script>

<template>
  <div>
    <label class="label">{{ label }}</label>
    <div class="relative">
      <input
        type="file"
        :accept="accept"
        @change="handleChange"
        class="input-field file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
      />
    </div>
    <p v-if="fileName" class="text-xs text-text-secondary mt-1">{{ fileName }}</p>
  </div>
</template>
