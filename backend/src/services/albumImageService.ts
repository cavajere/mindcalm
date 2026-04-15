import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { Status } from '@prisma/client'
import { deleteFile } from './fileService'

type AlbumImageDependency = {
  type: 'AUDIO' | 'POST'
  entityId: string
  label: string
  path: string
  status: Status
}

type AlbumImageReference = {
  id: string
  filePath: string
  originalName: string
  displayName: string
  title: string | null
  description: string | null
  mimeType: string
  size: number
}

type SerializedAlbumImageReference = {
  id: string
  title: string | null
  description: string | null
  filename: string
  originalName: string
  displayName: string
  mimeType: string
  size: number
  url: string | null
}

type AlbumImageWithDependencies = AlbumImageReference & {
  createdAt: Date
  updatedAt: Date
  audioCoverFor?: Array<{ id: string; title: string; status: Status }>
  postCoverFor?: Array<{ id: string; title: string; status: Status }>
}

type CoverImageSource = {
  coverImage: string | null
  coverImageOriginalName: string | null
  coverImageDisplayName: string | null
  coverAlbumImage?: SerializedAlbumImageReference | null
}

export function buildImageUrl(filePath: string | null) {
  return filePath ? `/api/files/images/${path.basename(filePath)}` : null
}

export function computeFileHash(filePath: string) {
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export function serializeAlbumImageReference(image: AlbumImageReference) {
  return {
    id: image.id,
    title: image.title,
    description: image.description,
    filename: image.displayName,
    originalName: image.originalName,
    displayName: image.displayName,
    mimeType: image.mimeType,
    size: image.size,
    url: buildImageUrl(image.filePath),
  }
}

export function getAlbumImageDependencies(image: AlbumImageWithDependencies): AlbumImageDependency[] {
  const audioDependencies = (image.audioCoverFor ?? []).map((audio) => ({
    type: 'AUDIO' as const,
    entityId: audio.id,
    label: `Audio: ${audio.title} (${audio.status === 'PUBLISHED' ? 'Pubblicato' : 'Bozza'})`,
    path: `/audio/${audio.id}/edit`,
    status: audio.status,
  }))
  const postDependencies = (image.postCoverFor ?? []).map((post) => ({
    type: 'POST' as const,
    entityId: post.id,
    label: `Post: ${post.title} (${post.status === 'PUBLISHED' ? 'Pubblicato' : 'Bozza'})`,
    path: `/posts/${post.id}/edit`,
    status: post.status,
  }))

  return [...audioDependencies, ...postDependencies]
    .sort((left, right) => left.label.localeCompare(right.label, 'it'))
}

export function serializeAlbumImage(image: AlbumImageWithDependencies) {
  const dependencies = getAlbumImageDependencies(image)

  return {
    ...serializeAlbumImageReference(image),
    dependencies,
    dependencyCount: dependencies.length,
    inUse: dependencies.length > 0,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
  }
}

export function resolveCoverImageSource(input: {
  coverImage: string | null
  coverImageOriginalName: string | null
  coverImageDisplayName: string | null
  coverAlbumImage?: AlbumImageReference | null
}): CoverImageSource {
  if (input.coverAlbumImage) {
    return {
      coverImage: buildImageUrl(input.coverAlbumImage.filePath),
      coverImageOriginalName: input.coverAlbumImage.originalName,
      coverImageDisplayName: input.coverAlbumImage.displayName,
      coverAlbumImage: serializeAlbumImageReference(input.coverAlbumImage),
    }
  }

  return {
    coverImage: buildImageUrl(input.coverImage),
    coverImageOriginalName: input.coverImageOriginalName,
    coverImageDisplayName: input.coverImageDisplayName,
    coverAlbumImage: null,
  }
}

export function deleteDirectCoverImage(filePath: string | null) {
  if (filePath) {
    deleteFile(filePath)
  }
}

export function deleteAlbumImageAsset(image: { filePath: string }) {
  deleteFile(image.filePath)
}
