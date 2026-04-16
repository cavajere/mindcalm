<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  panelClass?: string
  overlayClass?: string
  closeOnBackdrop?: boolean
}>(), {
  panelClass: '',
  overlayClass: '',
  closeOnBackdrop: true,
})

const emit = defineEmits<{
  close: []
}>()

const panelRef = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''

function close() {
  emit('close')
}

function syncBodyScrollLock(isOpen: boolean) {
  if (typeof document === 'undefined') return

  if (isOpen) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }

  document.body.style.overflow = previousBodyOverflow
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

function handleBackdropClick() {
  if (!props.closeOnBackdrop) return
  close()
}

watch(
  () => props.open,
  async (isOpen) => {
    syncBodyScrollLock(isOpen)

    if (isOpen) {
      await nextTick()
      panelRef.value?.focus()
    }
  },
  { immediate: true },
)

watch(
  () => props.open,
  (isOpen) => {
    if (typeof window === 'undefined') return

    if (isOpen) {
      window.addEventListener('keydown', handleKeydown)
      return
    }

    window.removeEventListener('keydown', handleKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  syncBodyScrollLock(false)
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm"
      :class="overlayClass"
      @click.self="handleBackdropClick"
    >
      <div
        ref="panelRef"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="w-full outline-none"
        :class="panelClass"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>
