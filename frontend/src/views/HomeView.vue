<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useAudioStore } from '../stores/audioStore'
import AudioCard from '../components/AudioCard.vue'
import ContentCover from '../components/ContentCover.vue'

interface PostItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
  author: string
  coverImage: string | null
  publishedAt: string
}

interface EventItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
  city: string
  venue: string | null
  startsAt: string
  coverImage: string | null
  cancelledAt: string | null
}

interface PaginatedResponse<T> {
  data: T[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const auth = useAuthStore()
const store = useAudioStore()

const latestPosts = ref<PostItem[]>([])
const latestEvents = ref<EventItem[]>([])
const featuredAudio = ref<any>(null)
const publicLoading = ref(true)
const publicCounts = ref({ events: 0 })

const latestStory = computed(() => latestPosts.value[0] ?? null)
const nextEvent = computed(() => latestEvents.value.find((event) => !event.cancelledAt) ?? null)

function formatArticleDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatCompactEventDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
  })
}

function formatCount(value: number) {
  return new Intl.NumberFormat('it-IT').format(value)
}

function pickFeaturedAudio() {
  if (!store.audioItems.length) {
    featuredAudio.value = null
    return
  }

  featuredAudio.value = store.audioItems[Math.floor(Math.random() * store.audioItems.length)]
}

async function loadPrivateHome() {
  await store.fetchCategories()
  await store.fetchAudio()
  pickFeaturedAudio()
}

async function loadPublicHome() {
  publicLoading.value = true

  const [postsResult, eventsResult] = await Promise.allSettled([
    axios.get<PaginatedResponse<PostItem>>('/api/posts?limit=4'),
    axios.get<PaginatedResponse<EventItem>>('/api/events?limit=3'),
  ])

  if (postsResult.status === 'fulfilled') {
    latestPosts.value = postsResult.value.data.data
  }

  if (eventsResult.status === 'fulfilled') {
    latestEvents.value = eventsResult.value.data.data
    publicCounts.value.events = Number(eventsResult.value.data.pagination?.total ?? latestEvents.value.length)
  }

  publicLoading.value = false
}

onMounted(async () => {
  const tasks = [loadPublicHome()]

  if (auth.isAuthenticated) {
    tasks.unshift(loadPrivateHome())
  }

  await Promise.all(tasks)
})
</script>

<template>
  <div class="page-container space-y-12 pb-10">
    <template v-if="auth.isAuthenticated">
      <section class="section-panel relative overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(74,144,217,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(80,184,96,0.14),_transparent_28%)]" />

        <div class="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:p-10">
          <div class="min-w-0">
            <span class="eyebrow">Area personale</span>
            <h1 class="font-display mt-5 text-4xl font-semibold leading-none text-text-primary sm:text-5xl lg:text-6xl">
              Un percorso più calmo, un ascolto alla volta.
            </h1>
            <p class="mt-5 max-w-2xl text-base leading-8 text-text-secondary sm:text-lg">
              Riprendi dai contenuti piu recenti, esplora per categoria e consulta post ed eventi pubblici quando vuoi approfondire.
            </p>

            <div class="mt-8 flex flex-wrap gap-3">
              <router-link to="/audio" class="btn-primary">Vai alla libreria audio</router-link>
              <router-link to="/posts" class="btn-secondary">Post pubblici</router-link>
              <router-link to="/events" class="btn-secondary">Eventi pubblici</router-link>
            </div>

            <div class="mt-8 grid gap-3 sm:grid-cols-3">
              <div class="surface-card-muted p-4">
                <p class="text-2xl font-semibold text-text-primary">{{ formatCount(store.audioItems.length) }}</p>
                <p class="mt-1 text-sm text-text-secondary">audio pronti all'ascolto</p>
              </div>
              <div class="surface-card-muted p-4">
                <p class="text-2xl font-semibold text-text-primary">{{ formatCount(store.categories.length) }}</p>
                <p class="mt-1 text-sm text-text-secondary">categorie da esplorare</p>
              </div>
              <div class="surface-card-muted p-4">
                <p class="text-2xl font-semibold text-text-primary">{{ formatCount(publicCounts.events) }}</p>
                <p class="mt-1 text-sm text-text-secondary">eventi disponibili in agenda</p>
              </div>
            </div>
          </div>

          <div v-if="featuredAudio" class="surface-inverse p-6">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] opacity-75">Suggerimento del giorno</p>
            <h2 class="mt-4 text-2xl font-semibold leading-tight">{{ featuredAudio.title }}</h2>
            <p class="mt-4 text-sm leading-7 opacity-80">
              {{ featuredAudio.description || 'Un contenuto da ascoltare quando vuoi ritrovare concentrazione e spazio mentale.' }}
            </p>

            <div class="mt-6 flex flex-wrap gap-2">
              <span class="inverse-chip">
                {{ featuredAudio.category?.name || 'Percorso guidato' }}
              </span>
              <span class="inverse-chip">
                {{ featuredAudio.level }}
              </span>
            </div>

            <router-link :to="`/audio/${featuredAudio.id}`" class="btn-primary mt-8 inline-flex items-center gap-2">
              Ascolta ora
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </router-link>
          </div>
        </div>
      </section>

      <section v-if="store.categories.length" class="space-y-5">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span class="eyebrow">Esplora</span>
            <h2 class="font-display mt-4 text-3xl font-semibold text-text-primary sm:text-4xl">Scegli il ritmo giusto per oggi</h2>
          </div>
          <p class="max-w-xl text-sm leading-7 text-text-secondary">
            Categorie semplici da capire, per arrivare piu rapidamente al contenuto che ti serve davvero.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <router-link
            v-for="cat in store.categories"
            :key="cat.id"
            :to="`/audio?category=${cat.id}`"
            class="card group p-4 text-left"
          >
            <div
              class="flex h-12 w-12 items-center justify-center rounded-2xl text-xl text-white transition-transform duration-200 group-hover:scale-105"
              :style="{ backgroundColor: cat.color || '#4A90D9' }"
            >
              {{ cat.icon === 'lotus' ? '🧘' : cat.icon === 'wind' ? '🌬️' : cat.icon === 'body' ? '🫁' : cat.icon === 'moon' ? '🌙' : '☀️' }}
            </div>
            <p class="mt-4 font-semibold text-text-primary">{{ cat.name }}</p>
            <p class="mt-1 text-sm text-text-secondary">{{ cat.audioCount }} audio disponibili</p>
          </router-link>
        </div>
      </section>

      <section v-if="store.audioItems.length" class="space-y-5">
        <div class="flex items-center justify-between gap-4">
          <div>
            <span class="eyebrow">Novita audio</span>
            <h2 class="font-display mt-4 text-3xl font-semibold text-text-primary sm:text-4xl">Gli ultimi percorsi pubblicati</h2>
          </div>
          <router-link to="/audio" class="btn-ghost hidden sm:inline-flex">Vedi tutto</router-link>
        </div>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AudioCard v-for="audio in store.audioItems.slice(0, 6)" :key="audio.id" :audio="audio" />
        </div>
      </section>
    </template>

    <template v-else>
      <section class="section-panel relative overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(74,144,217,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(80,184,96,0.14),_transparent_30%)]" />

        <div class="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:p-10">
          <div class="min-w-0">
            <h1 class="font-display mt-5 text-5xl font-semibold leading-none text-text-primary sm:text-6xl lg:text-[4.5rem]">
              Spazio per respirare, capire, ricominciare.
            </h1>
            <p class="mt-5 max-w-2xl text-base leading-8 text-text-secondary sm:text-xl">
              Nella parte pubblica trovi due percorsi chiari: post per approfondire con calma ed eventi per capire cosa sta per succedere.
            </p>

            <div class="mt-8 flex flex-wrap gap-3">
              <router-link to="/posts" class="btn-primary">Post</router-link>
              <router-link to="/events" class="btn-secondary">Eventi</router-link>
              <router-link to="/login" class="btn-ghost">Accedi</router-link>
            </div>
          </div>

          <div class="space-y-4">
            <div class="surface-inverse p-6">
              <p class="text-xs font-semibold uppercase tracking-[0.24em] opacity-75">Parti da qui</p>

              <template v-if="latestStory">
                <p class="mt-4 text-sm font-medium opacity-70">Ultimo post pubblicato</p>
                <h2 class="mt-2 text-2xl font-semibold leading-tight">{{ latestStory.title }}</h2>
                <p class="mt-4 text-sm leading-7 opacity-80">
                  {{ latestStory.excerpt || 'Una lettura breve per orientarti tra pratica, consapevolezza e benessere mentale.' }}
                </p>
                <div class="mt-6 flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] opacity-60">
                  <span>{{ formatArticleDate(latestStory.publishedAt) }}</span>
                  <span>{{ latestStory.author }}</span>
                </div>
                <router-link :to="`/posts/${latestStory.slug}`" class="btn-primary mt-6 inline-flex items-center gap-2">
                  Apri il post
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5l7 7-7 7" />
                  </svg>
                </router-link>
              </template>

              <template v-else-if="nextEvent">
                <p class="mt-4 text-sm font-medium opacity-70">Prossimo evento aperto</p>
                <h2 class="mt-2 text-2xl font-semibold leading-tight">{{ nextEvent.title }}</h2>
                <p class="mt-4 text-sm leading-7 opacity-80">
                  {{ nextEvent.excerpt || 'Un incontro pubblico per approfondire pratiche, strumenti e nuove abitudini di benessere.' }}
                </p>
                <div class="mt-6 flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] opacity-60">
                  <span>{{ formatEventDate(nextEvent.startsAt) }}</span>
                  <span>{{ nextEvent.city }}</span>
                </div>
                <router-link :to="`/events/${nextEvent.slug}`" class="btn-primary mt-6 inline-flex items-center gap-2">
                  Vai all'evento
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5l7 7-7 7" />
                  </svg>
                </router-link>
              </template>

              <template v-else>
                <p class="mt-4 text-2xl font-semibold leading-tight">Nuovi contenuti in arrivo</p>
                <p class="mt-4 text-sm leading-7 opacity-80">
                  Quando verranno pubblicati post o eventi, li troverai qui in evidenza. Nel frattempo puoi accedere con il tuo account oppure attivare un invito.
                </p>
                <div class="mt-6 flex flex-wrap gap-2">
                  <span class="inverse-chip">
                    Nuovi contenuti in arrivo
                  </span>
                  <span class="inverse-chip">
                    Accesso ai percorsi con invito
                  </span>
                </div>
              </template>
            </div>

            <div class="card p-5">
              <p class="text-sm font-semibold text-text-primary">Contenuti riservati ai membri</p>
              <p class="mt-2 text-sm leading-7 text-text-secondary">
                Le meditazioni guidate, i percorsi audio e l'ascolto in app sono disponibili esclusivamente per chi ha ricevuto un invito. Qui trovi una panoramica del progetto e degli articoli aperti a tutti.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div class="space-y-5">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span class="eyebrow">Ultimi post</span>
              <h2 class="font-display mt-4 text-3xl font-semibold text-text-primary sm:text-4xl">Letture</h2>
            </div>
            <router-link to="/posts" class="btn-ghost hidden sm:inline-flex">Tutti i post</router-link>
          </div>

          <div v-if="publicLoading" class="grid gap-5 sm:grid-cols-2">
            <div v-for="item in 2" :key="item" class="card animate-pulse overflow-hidden">
              <div class="aspect-[4/3] skeleton-block"></div>
              <div class="space-y-3 p-5">
                <div class="skeleton-block h-3 w-24 rounded-full"></div>
                <div class="skeleton-block h-8 w-4/5 rounded-2xl"></div>
                <div class="skeleton-block h-4 w-full"></div>
                <div class="skeleton-block h-4 w-3/4"></div>
              </div>
            </div>
          </div>

          <div v-else-if="latestPosts.length" class="grid gap-5 sm:grid-cols-2">
            <router-link
              v-for="article in latestPosts"
              :key="article.id"
              :to="`/posts/${article.slug}`"
              class="card group overflow-hidden"
            >
              <ContentCover
                v-if="article.coverImage"
                :src="article.coverImage"
                :alt="article.title"
                container-class="aspect-[4/3] overflow-hidden"
                image-class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div class="p-5" :class="{ 'pt-6': !article.coverImage }">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  {{ formatArticleDate(article.publishedAt) }}
                </p>
                <h3 class="mt-3 text-xl font-semibold leading-tight text-text-primary">
                  {{ article.title }}
                </h3>
                <p class="mt-3 text-sm leading-7 text-text-secondary">
                  {{ article.excerpt || 'Una lettura breve per ritrovare prospettiva e trasformare intuizioni in pratica quotidiana.' }}
                </p>
                <p class="mt-4 text-sm font-medium text-primary">Di {{ article.author }}</p>
              </div>
            </router-link>
          </div>

          <div v-else class="card p-6">
            <p class="text-lg font-semibold text-text-primary">Nessun post pubblicato per ora</p>
            <p class="mt-3 max-w-2xl text-sm leading-7 text-text-secondary">
              Qui compariranno automaticamente gli ultimi post pubblici non appena saranno disponibili.
            </p>
          </div>
        </div>

        <div class="space-y-5">
          <div>
            <span class="eyebrow">Prossimi eventi</span>
            <h2 class="font-display mt-4 text-3xl font-semibold text-text-primary sm:text-4xl">Incontri e appuntamenti aperti</h2>
          </div>

          <div v-if="publicLoading" class="space-y-4">
            <div v-for="item in 3" :key="item" class="card animate-pulse p-5">
              <div class="skeleton-block h-3 w-24 rounded-full"></div>
              <div class="skeleton-block mt-3 h-7 w-4/5 rounded-2xl"></div>
              <div class="skeleton-block mt-3 h-4 w-full"></div>
              <div class="skeleton-block mt-2 h-4 w-3/4"></div>
            </div>
          </div>

          <div v-else-if="latestEvents.length" class="space-y-4">
            <router-link
              v-for="eventItem in latestEvents"
              :key="eventItem.id"
              :to="`/events/${eventItem.slug}`"
              class="card block p-5"
            >
              <div class="flex items-start gap-4">
                <div class="surface-card-muted flex min-h-16 min-w-16 flex-col items-center justify-center text-primary">
                  <span class="text-lg font-semibold leading-none">{{ formatCompactEventDate(eventItem.startsAt).split(' ')[0] }}</span>
                  <span class="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                    {{ formatCompactEventDate(eventItem.startsAt).split(' ').slice(1).join(' ') }}
                  </span>
                </div>

                <div class="min-w-0">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    {{ eventItem.city }}<span v-if="eventItem.venue"> · {{ eventItem.venue }}</span>
                  </p>
                  <h3 class="mt-2 text-xl font-semibold leading-tight text-text-primary">{{ eventItem.title }}</h3>
                  <p class="mt-3 text-sm leading-7 text-text-secondary">
                    {{ eventItem.excerpt || 'Un appuntamento pensato per portare pratica, ascolto e confronto in uno spazio condiviso.' }}
                  </p>
                </div>
              </div>
            </router-link>
          </div>

          <div v-else class="card p-6">
            <p class="text-lg font-semibold text-text-primary">Ancora nessun evento pubblico</p>
            <p class="mt-3 text-sm leading-7 text-text-secondary">
              Quando saranno programmati nuovi appuntamenti, questa sezione mostrerà automaticamente i prossimi eventi aperti.
            </p>
          </div>
        </div>
      </section>

      <section class="section-panel overflow-hidden">
        <div class="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
          <div>
            <span class="eyebrow">Accesso riservato</span>
            <h2 class="font-display mt-4 text-3xl font-semibold text-text-primary sm:text-4xl">
              Quando vuoi ascoltare, entra nell'area personale.
            </h2>
            <p class="mt-4 max-w-2xl text-base leading-8 text-text-secondary">
              La parte pubblica introduce il progetto. L'area riservata sblocca meditazioni guidate, cronologia di ascolto e percorsi strutturati.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <router-link to="/login" class="btn-secondary">Accedi</router-link>
            <router-link to="/register" class="btn-primary">Hai un invito?</router-link>
          </div>
        </div>
      </section>
    </template>

    <section v-if="auth.isAuthenticated && latestPosts.length" class="space-y-5">
      <div class="flex items-center justify-between gap-4">
        <div>
          <span class="eyebrow">Post pubblici</span>
          <h2 class="font-display mt-4 text-3xl font-semibold text-text-primary sm:text-4xl">Post</h2>
        </div>
        <router-link to="/posts" class="btn-ghost hidden sm:inline-flex">Tutti i post</router-link>
      </div>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <router-link
          v-for="article in latestPosts.slice(0, 3)"
          :key="article.id"
          :to="`/posts/${article.slug}`"
          class="card overflow-hidden"
        >
          <ContentCover
            v-if="article.coverImage"
            :src="article.coverImage"
            :alt="article.title"
            container-class="aspect-video"
            image-class="h-full w-full object-cover"
          />
          <div class="p-5" :class="{ 'pt-6': !article.coverImage }">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{{ formatArticleDate(article.publishedAt) }}</p>
            <h3 class="mt-3 text-lg font-semibold leading-tight text-text-primary">{{ article.title }}</h3>
            <p class="mt-3 text-sm leading-7 text-text-secondary">
              {{ article.excerpt || 'Un approfondimento pubblico per aggiungere contesto e strumenti pratici al tuo percorso.' }}
            </p>
          </div>
        </router-link>
      </div>
    </section>

    <section v-if="auth.isAuthenticated && latestEvents.length" class="space-y-5">
      <div class="flex items-center justify-between gap-4">
        <div>
          <span class="eyebrow">Agenda</span>
          <h2 class="font-display mt-4 text-3xl font-semibold text-text-primary sm:text-4xl">Eventi in programma</h2>
        </div>
        <router-link to="/events" class="btn-ghost hidden sm:inline-flex">Tutti gli eventi</router-link>
      </div>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <router-link
          v-for="eventItem in latestEvents"
          :key="eventItem.id"
          :to="`/events/${eventItem.slug}`"
          class="card overflow-hidden"
        >
          <ContentCover
            v-if="eventItem.coverImage"
            :src="eventItem.coverImage"
            :alt="eventItem.title"
            container-class="aspect-video"
            image-class="h-full w-full object-cover"
          />
          <div class="p-5" :class="{ 'pt-6': !eventItem.coverImage }">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {{ formatEventDate(eventItem.startsAt) }} · {{ eventItem.city }}
            </p>
            <h3 class="mt-3 text-lg font-semibold leading-tight text-text-primary">{{ eventItem.title }}</h3>
            <p class="mt-3 text-sm leading-7 text-text-secondary">
              {{ eventItem.excerpt || 'Un appuntamento pubblico per approfondire pratiche, strumenti e nuove abitudini di benessere.' }}
            </p>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>
