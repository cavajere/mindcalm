import { ref, onMounted } from 'vue'

export function useInstall() {
  const canInstall = ref(false)
  let deferredPrompt: any = null

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault()
      deferredPrompt = e
      canInstall.value = true
    })

    window.addEventListener('appinstalled', () => {
      canInstall.value = false
      deferredPrompt = null
    })
  })

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      canInstall.value = false
    }
    deferredPrompt = null
  }

  return { canInstall, install }
}
