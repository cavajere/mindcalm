export type AlbumImageDependency = {
  type: 'AUDIO' | 'POST'
  entityId: string
  label: string
  path: string
  status: 'DRAFT' | 'PUBLISHED'
}

export type AlbumImage = {
  id: string
  title: string | null
  description: string | null
  filename: string
  originalName: string
  displayName: string
  mimeType: string
  size: number
  url: string | null
  dependencies: AlbumImageDependency[]
  dependencyCount: number
  inUse: boolean
  createdAt: string
  updatedAt: string
}
