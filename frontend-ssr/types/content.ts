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

export interface CoverImageFields {
  coverImage?: string | null
  coverImageOriginalName?: string | null
  coverImageDisplayName?: string | null
}

export interface PublicAudio extends CoverImageFields {
  id: string
  title: string
  description?: string | null
  durationSec?: number | null
  publishedAt?: string | null
}

export interface PublicPost extends CoverImageFields {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  body?: string | null
  publishedAt?: string | null
}

export interface PublicEvent extends CoverImageFields {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  body?: string | null
  city?: string | null
  venue?: string | null
  startsAt?: string | null
  publishedAt?: string | null
}
