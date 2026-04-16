import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Notification {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])

  function showNotification(message: string, type: Notification['type'] = 'info', duration = 5000) {
    const id = Date.now().toString()
    const notification: Notification = { id, message, type, duration }
    
    notifications.value.push(notification)
    
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }
    
    return id
  }

  function removeNotification(id: string) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  function showError(message: string) {
    return showNotification(message, 'error')
  }

  function showSuccess(message: string) {
    return showNotification(message, 'success')
  }

  function clear() {
    notifications.value = []
  }

  return {
    notifications,
    showNotification,
    removeNotification,
    showError,
    showSuccess,
    clear,
  }
})