import { ref } from 'vue'

export interface ConfirmOptions {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
}

const visible = ref(false)
const options = ref<ConfirmOptions>({ message: '' })

let resolvePromise: ((value: boolean) => void) | null = null

function confirm(opts: string | ConfirmOptions): Promise<boolean> {
  const normalized = typeof opts === 'string' ? { message: opts } : opts
  options.value = normalized
  visible.value = true

  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve
  })
}

function accept() {
  visible.value = false
  resolvePromise?.(true)
  resolvePromise = null
}

function cancel() {
  visible.value = false
  resolvePromise?.(false)
  resolvePromise = null
}

export function useConfirm() {
  return { visible, options, confirm, accept, cancel }
}
