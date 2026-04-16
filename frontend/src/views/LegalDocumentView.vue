<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import RichTextRenderer from '../components/RichTextRenderer.vue'

const props = defineProps<{
  documentType: 'privacy' | 'terms'
}>()

type LegalDocumentsResponse = {
  privacy: { title: string; url: string; publishedAt?: string | null } | null
  terms: { title: string; url: string; publishedAt?: string | null } | null
}

const loading = ref(true)
const documentData = ref<LegalDocumentsResponse | null>(null)
const documentHtml = ref('')

const pageConfig = computed(() => props.documentType === 'privacy'
  ? {
      title: 'Privacy policy',
      eyebrow: 'Documento legale',
      fallbackUrl: '/public-api/privacy?lang=it',
      emptyTitle: 'Privacy policy non disponibile',
      emptyBody: 'La privacy policy pubblicata non e al momento disponibile. Riprova piu tardi.',
    }
  : {
      title: 'Termini e condizioni',
      eyebrow: 'Documento legale',
      fallbackUrl: '/public-api/terms?lang=it',
      emptyTitle: 'Termini e condizioni non disponibili',
      emptyBody: 'I termini e condizioni pubblicati non sono al momento disponibili. Riprova piu tardi.',
    },
)

const selectedDocument = computed(() => (
  props.documentType === 'privacy'
    ? documentData.value?.privacy ?? null
    : documentData.value?.terms ?? null
))

const publicUrl = computed(() => selectedDocument.value?.url || pageConfig.value.fallbackUrl)

const publishedLabel = computed(() => {
  if (!selectedDocument.value?.publishedAt) return ''

  return new Date(selectedDocument.value.publishedAt).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

async function loadDocument() {
  loading.value = true

  try {
    const { data } = await axios.get<LegalDocumentsResponse>('/public-api/legal-documents?lang=it')
    documentData.value = data
    documentHtml.value = ''

    const response = await axios.get<string>(publicUrl.value, {
      responseType: 'text',
      headers: {
        Accept: 'text/html',
      },
    })

    const parsed = new DOMParser().parseFromString(response.data, 'text/html')
    const mainContent = parsed.querySelector('main')

    if (mainContent) {
      const firstHeading = mainContent.querySelector('h1')
      firstHeading?.remove()
      documentHtml.value = mainContent.innerHTML.trim()
    }
  } catch {
    documentData.value = null
    documentHtml.value = ''
  } finally {
    loading.value = false
  }
}

onMounted(loadDocument)

watch(() => props.documentType, () => {
  loadDocument()
})
</script>

<template>
  <div class="page-container space-y-8 pb-10">
    <section class="section-panel relative overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(74,144,217,0.15),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(80,184,96,0.1),_transparent_28%)]" />

      <div class="relative grid gap-6 p-6 sm:p-8 lg:p-10">
        <div>
          <span class="eyebrow">{{ pageConfig.eyebrow }}</span>
          <h1 class="font-display mt-4 text-4xl font-semibold leading-none text-text-primary sm:text-5xl">
            {{ selectedDocument?.title || pageConfig.title }}
          </h1>
          <p class="mt-4 max-w-3xl text-base leading-8 text-text-secondary sm:text-lg">
            Consulta il testo pubblicato di riferimento in una pagina dedicata, sempre raggiungibile anche dal footer dell’area pubblica.
          </p>
        </div>

        <div class="max-w-xs">
          <div class="surface-card-muted p-4">
            <p class="text-sm font-semibold text-text-primary">
              {{ publishedLabel || 'Versione attuale' }}
            </p>
            <p class="mt-1 text-sm text-text-secondary">
              {{ publishedLabel ? 'data di pubblicazione' : 'nessuna data disponibile' }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <div v-if="loading" class="surface-card animate-pulse p-4 sm:p-6">
      <div class="skeleton-block h-[70vh] w-full rounded-[24px]"></div>
    </div>

    <section v-else-if="selectedDocument && documentHtml" class="surface-card overflow-hidden p-6 sm:p-8">
      <div class="mx-auto max-w-4xl">
        <RichTextRenderer :html="documentHtml" />
      </div>
    </section>

    <section v-else class="section-panel p-8 text-center sm:p-10">
      <div class="mx-auto max-w-2xl">
        <span class="eyebrow">Documento non disponibile</span>
        <h2 class="mt-5 text-2xl font-semibold text-text-primary sm:text-3xl">{{ pageConfig.emptyTitle }}</h2>
        <p class="mt-4 text-base leading-8 text-text-secondary">
          {{ pageConfig.emptyBody }}
        </p>
      </div>
    </section>
  </div>
</template>
