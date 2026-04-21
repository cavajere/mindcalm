export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface PublicAudio {
  id: string
  title: string
  description?: string | null
  durationSec?: number | null
  coverImageUrl?: string | null
}

export interface PublicPost {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  body?: string | null
  coverImageUrl?: string | null
  publishedAt?: string | null
}

export interface PublicEvent {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  body?: string | null
  city?: string | null
  venue?: string | null
  startsAt?: string | null
  coverImageUrl?: string | null
}
