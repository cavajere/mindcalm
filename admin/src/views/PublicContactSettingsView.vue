<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import PageHeader from '../components/PageHeader.vue'
import { useToast } from '../composables/useToast'
import { getApiErrorMessage } from '../utils/apiMessages'

type PublicContactSettingsResponse = {
  id: number
  title: string
  description: string
  email: string
  phone: string
  whatsappNumber: string
  whatsappEnabled: boolean
  whatsappUrl: string | null
  hasContacts: boolean
  updatedAt: string | null
}

const toast = useToast()
const loading = ref(false)
const form = ref({
  title: '',
  description: '',
  email: '',
  phone: '',
  whatsappNumber: '',
  whatsappEnabled: false,
})

const publicLinkVisible = computed(() => {
  const hasWhatsapp = form.value.whatsappEnabled && form.value.whatsappNumber.trim()
  return Boolean(
    form.value.description.trim()
    || form.value.email.trim()
    || form.value.phone.trim()
    || hasWhatsapp,
  )
})

async function fetchSettings() {
  loading.value = true

  try {
    const { data } = await axios.get<PublicContactSettingsResponse>('/api/admin/settings/contact')
    form.value = {
      title: data.title || '',
      description: data.description || '',
      email: data.email || '',
      phone: data.phone || '',
      whatsappNumber: data.whatsappNumber || '',
      whatsappEnabled: data.whatsappEnabled,
    }
  } catch (err) {
    toast.error(getApiErrorMessage(err, 'Caricamento contatti pubblici fallito'))
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  loading.value = true

  try {
    await axios.put('/api/admin/settings/contact', {
      title: form.value.title || null,
      description: form.value.description || null,
      email: form.value.email || null,
      phone: form.value.phone || null,
      whatsappNumber: form.value.whatsappNumber || null,
      whatsappEnabled: form.value.whatsappEnabled,
    })

    toast.success('Contatti pubblici salvati')
    await fetchSettings()
  } catch (err) {
    toast.error(getApiErrorMessage(err, 'Salvataggio contatti pubblici fallito'))
  } finally {
    loading.value = false
  }
}

onMounted(fetchSettings)
</script>

<template>
  <div class="mx-auto w-full max-w-4xl">
    <PageHeader
      title="Contatti pubblici"
      description="Configura i dati generali da mostrare nel footer dell'area pubblica tramite link Contatti e modale dedicata."
    />

    <form class="card space-y-8" @submit.prevent="saveSettings">
      <section class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="md:col-span-2">
          <label class="label">Titolo modale</label>
          <input
            v-model="form.title"
            type="text"
            maxlength="120"
            class="input-field"
            placeholder="Contatti e informazioni"
          />
        </div>

        <div class="md:col-span-2">
          <label class="label">Testo introduttivo</label>
          <textarea
            v-model="form.description"
            rows="4"
            maxlength="1000"
            class="input-field"
            placeholder="Usa questi riferimenti per richiedere informazioni su eventi, percorsi o iniziative."
          />
        </div>

        <div>
          <label class="label">Email contatti</label>
          <input
            v-model="form.email"
            type="email"
            class="input-field"
            placeholder="info@example.com"
          />
        </div>

        <div>
          <label class="label">Telefono</label>
          <input
            v-model="form.phone"
            type="text"
            class="input-field"
            placeholder="+39 333 1234567"
          />
        </div>

        <div>
          <label class="label">Numero WhatsApp</label>
          <input
            v-model="form.whatsappNumber"
            type="text"
            class="input-field"
            placeholder="+39 333 1234567"
          />
        </div>

        <div class="flex items-end">
          <label class="flex items-center gap-3 text-sm text-text-primary">
            <input
              v-model="form.whatsappEnabled"
              type="checkbox"
              class="rounded border-gray-300 text-primary focus:ring-primary/30"
            />
            Mostra il canale WhatsApp nell'area pubblica
          </label>
        </div>
      </section>

      <section class="rounded-xl border border-ui-border bg-background px-4 py-4 text-sm text-text-secondary">
        <p class="font-medium text-text-primary">Comportamento nel footer pubblico</p>
        <p class="mt-2">
          Il link <span class="font-medium text-text-primary">Contatti</span>
          {{ publicLinkVisible ? ' sara visibile e aprira la modale con i dati configurati.' : ' restera nascosto finche non configuri almeno un recapito o un testo introduttivo.' }}
        </p>
        <p class="mt-2">
          Se abiliti WhatsApp, nel popup comparira anche l'icona dedicata con link diretto alla chat.
        </p>
      </section>

      <div class="flex justify-end">
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'Salvataggio...' : 'Salva contatti pubblici' }}
        </button>
      </div>
    </form>
  </div>
</template>
