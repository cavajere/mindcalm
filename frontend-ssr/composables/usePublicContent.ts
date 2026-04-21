import type { PaginatedResponse, PublicAudio, PublicEvent, PublicPost } from '~/types/content'

export async function fetchPostList() {
  const { data, error } = await useApi<PaginatedResponse<PublicPost>>('/api/posts')
  if (error.value) throw createError({ statusCode: 502, statusMessage: 'Errore caricamento post' })
  return data.value?.data ?? []
}

export async function fetchPostDetail(slug: string) {
  const { data, error } = await useApi<PublicPost>(`/api/posts/${slug}`)
  if (error.value) {
    throw createError({
      statusCode: (error.value as any)?.statusCode || 404,
      statusMessage: 'Articolo non trovato',
    })
  }
  return data.value
}

export async function fetchAudioList() {
  const { data, error } = await useApi<PaginatedResponse<PublicAudio>>('/api/audio')
  if (error.value) throw createError({ statusCode: 502, statusMessage: 'Errore caricamento audio' })
  return data.value?.data ?? []
}

export async function fetchAudioDetail(id: string) {
  const { data, error } = await useApi<PublicAudio>(`/api/audio/${id}`)
  if (error.value) {
    throw createError({
      statusCode: (error.value as any)?.statusCode || 404,
      statusMessage: 'Audio non trovato',
    })
  }
  return data.value
}

export async function fetchEventList() {
  const { data, error } = await useApi<PaginatedResponse<PublicEvent>>('/api/events')
  if (error.value) throw createError({ statusCode: 502, statusMessage: 'Errore caricamento eventi' })
  return data.value?.data ?? []
}

export async function fetchEventDetail(slug: string) {
  const { data, error } = await useApi<PublicEvent>(`/api/events/${slug}`)
  if (error.value) {
    throw createError({
      statusCode: (error.value as any)?.statusCode || 404,
      statusMessage: 'Evento non trovato',
    })
  }
  return data.value
}
