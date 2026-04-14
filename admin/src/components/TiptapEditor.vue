<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
  placeholder?: string
}>(), {
  disabled: false,
  placeholder: 'Scrivi il contenuto...',
})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editor = useEditor({
  content: props.modelValue,
  editable: !props.disabled,
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false }),
    Image,
    Placeholder.configure({ placeholder: props.placeholder }),
  ],
  onUpdate: () => {
    emit('update:modelValue', editor.value?.getHTML() || '')
  },
})

watch(() => props.modelValue, (val) => {
  if (editor.value && editor.value.getHTML() !== val) {
    editor.value.commands.setContent(val, false)
  }
})

watch(() => props.disabled, (disabled) => {
  editor.value?.setEditable(!disabled)
})

function setLink() {
  const url = prompt('URL del link:')
  if (url) {
    editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
}

function addImage() {
  const url = prompt('URL dell\'immagine:')
  if (url) {
    editor.value?.chain().focus().setImage({ src: url }).run()
  }
}

const buttons = [
  { label: 'B', action: () => editor.value?.chain().focus().toggleBold().run(), active: () => editor.value?.isActive('bold') },
  { label: 'I', action: () => editor.value?.chain().focus().toggleItalic().run(), active: () => editor.value?.isActive('italic') },
  { label: 'H2', action: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(), active: () => editor.value?.isActive('heading', { level: 2 }) },
  { label: 'H3', action: () => editor.value?.chain().focus().toggleHeading({ level: 3 }).run(), active: () => editor.value?.isActive('heading', { level: 3 }) },
  { label: 'UL', action: () => editor.value?.chain().focus().toggleBulletList().run(), active: () => editor.value?.isActive('bulletList') },
  { label: 'OL', action: () => editor.value?.chain().focus().toggleOrderedList().run(), active: () => editor.value?.isActive('orderedList') },
  { label: 'Quote', action: () => editor.value?.chain().focus().toggleBlockquote().run(), active: () => editor.value?.isActive('blockquote') },
  { label: 'Link', action: setLink, active: () => editor.value?.isActive('link') },
  { label: 'Img', action: addImage, active: () => false },
  { label: 'Undo', action: () => editor.value?.chain().focus().undo().run(), active: () => false },
  { label: 'Redo', action: () => editor.value?.chain().focus().redo().run(), active: () => false },
]
</script>

<template>
  <div class="tiptap-editor border border-gray-200 rounded-lg overflow-hidden" :class="props.disabled ? 'bg-slate-50' : 'bg-white'">
    <!-- Toolbar -->
    <div class="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
      <button
        v-for="btn in buttons"
        :key="btn.label"
        type="button"
        :disabled="props.disabled"
        @click="btn.action"
        :class="[
          'px-2 py-1 text-xs font-medium rounded transition-colors',
          btn.active?.() ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200',
          props.disabled ? 'cursor-not-allowed opacity-50' : ''
        ]"
      >
        {{ btn.label }}
      </button>
    </div>

    <EditorContent :editor="editor" />
  </div>
</template>
