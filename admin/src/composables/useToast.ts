import { useUiStore, type ToastVariant } from '../stores/uiStore'

const AUTO_DISMISS: Record<ToastVariant, number> = {
  success: 4000,
  error: 7000,
  warning: 5000,
  info: 4000,
}

export function useToast() {
  const ui = useUiStore()

  function success(message: string) {
    return ui.addToast('success', message, AUTO_DISMISS.success)
  }

  function error(message: string) {
    return ui.addToast('error', message, AUTO_DISMISS.error)
  }

  function warning(message: string) {
    return ui.addToast('warning', message, AUTO_DISMISS.warning)
  }

  function info(message: string) {
    return ui.addToast('info', message, AUTO_DISMISS.info)
  }

  function dismiss(id: string) {
    ui.removeToast(id)
  }

  return { success, error, warning, info, dismiss }
}
