import fs from 'fs'
import path from 'path'
import { Status } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { config } from '../config'

type StorageAreaKey = 'audio' | 'images' | 'hls'
type StorageEntryKind = 'FILE' | 'DIRECTORY'
type StorageSourceType = 'AUDIO_FILE' | 'AUDIO_COVER' | 'THOUGHT_COVER' | 'ALBUM_IMAGE' | 'HLS_PACKAGE' | 'UNTRACKED'
type LinkedEntityType = 'AUDIO' | 'THOUGHT'

type StorageLinkedEntity = {
  type: LinkedEntityType
  entityId: string
  label: string
  path: string
  status: Status | null
}

type StorageAreaOverview = {
  key: StorageAreaKey
  label: string
  rootPath: string
  totalSize: number
  entryCount: number
  fileCount: number
  linkedEntryCount: number
  unlinkedEntryCount: number
  largestItem: StorageLargestItem | null
}

export type StorageLargestItem = {
  area: StorageAreaKey
  areaLabel: string
  kind: StorageEntryKind
  sourceType: StorageSourceType
  sourceLabel: string
  name: string
  relativePath: string
  absolutePath: string
  extension: string | null
  size: number
  fileCount: number
  relatedEntities: StorageLinkedEntity[]
}

export type StorageOverview = {
  generatedAt: string
  totalSize: number
  totalEntries: number
  totalPhysicalFiles: number
  linkedEntries: number
  unlinkedEntries: number
  areas: StorageAreaOverview[]
  largestItems: StorageLargestItem[]
  largestUnlinkedItems: StorageLargestItem[]
}

export type PaginatedStorageItems = {
  data: StorageLargestItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

type ReferenceEntry = {
  area: StorageAreaKey
  kind: StorageEntryKind
  sourceType: Exclude<StorageSourceType, 'UNTRACKED'>
  sourceLabel: string
  name: string
  relativePath: string
  relatedEntities: StorageLinkedEntity[]
}

type FilesystemEntry = {
  area: StorageAreaKey
  kind: StorageEntryKind
  relativePath: string
  absolutePath: string
  name: string
  size: number
  fileCount: number
}

const STORAGE_AREAS: Array<{ key: StorageAreaKey; label: string; rootPath: string }> = [
  { key: 'audio', label: 'Audio sorgente', rootPath: config.storage.audioPath },
  { key: 'images', label: 'Immagini', rootPath: config.storage.imagesPath },
  { key: 'hls', label: 'Streaming HLS', rootPath: config.storage.hlsPath },
]

function buildStorageKey(area: StorageAreaKey, relativePath: string) {
  return `${area}:${relativePath}`
}

function normalizeStorageRelativePath(filePath: string) {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^(audio|images|hls)\//, '')
    .replace(/^\/+/, '')
}

function getFileExtension(fileName: string) {
  const extension = path.extname(fileName).replace('.', '').trim().toLowerCase()
  return extension || null
}

function getHlsEntryRelativePath(manifestPath: string) {
  const normalized = normalizeStorageRelativePath(manifestPath)
  const firstSegment = normalized.split('/').filter(Boolean)[0]
  return firstSegment || normalized
}

function appendRelatedEntities(existing: StorageLinkedEntity[], next: StorageLinkedEntity[]) {
  const deduped = new Map(existing.map((entity) => [`${entity.type}:${entity.entityId}:${entity.path}`, entity]))

  next.forEach((entity) => {
    deduped.set(`${entity.type}:${entity.entityId}:${entity.path}`, entity)
  })

  return Array.from(deduped.values()).sort((left, right) => left.label.localeCompare(right.label, 'it'))
}

function upsertReference(
  references: Map<string, ReferenceEntry>,
  entry: ReferenceEntry,
) {
  const key = buildStorageKey(entry.area, entry.relativePath)
  const existing = references.get(key)

  if (!existing) {
    references.set(key, entry)
    return
  }

  references.set(key, {
    ...existing,
    name: existing.name || entry.name,
    relatedEntities: appendRelatedEntities(existing.relatedEntities, entry.relatedEntities),
  })
}

async function safeReadDirectory(directoryPath: string) {
  try {
    return await fs.promises.readdir(directoryPath, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function safeStat(targetPath: string) {
  try {
    return await fs.promises.stat(targetPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }

    throw error
  }
}

async function collectLeafFiles(
  area: StorageAreaKey,
  rootPath: string,
  currentRelativePath = '',
): Promise<FilesystemEntry[]> {
  const absolutePath = currentRelativePath ? path.join(rootPath, currentRelativePath) : rootPath
  const entries = await safeReadDirectory(absolutePath)
  const collected: FilesystemEntry[] = []

  for (const entry of entries) {
    const relativePath = currentRelativePath
      ? path.posix.join(currentRelativePath.replace(/\\/g, '/'), entry.name)
      : entry.name
    const fullPath = path.join(rootPath, relativePath)

    if (entry.isDirectory()) {
      collected.push(...await collectLeafFiles(area, rootPath, relativePath))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const stats = await safeStat(fullPath)
    if (!stats) continue

    collected.push({
      area,
      kind: 'FILE',
      relativePath,
      absolutePath: fullPath,
      name: entry.name,
      size: stats.size,
      fileCount: 1,
    })
  }

  return collected
}

async function summarizeDirectory(directoryPath: string): Promise<{ size: number; fileCount: number }> {
  const entries = await safeReadDirectory(directoryPath)
  let size = 0
  let fileCount = 0

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      const nested = await summarizeDirectory(fullPath)
      size += nested.size
      fileCount += nested.fileCount
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const stats = await safeStat(fullPath)
    if (!stats) continue

    size += stats.size
    fileCount += 1
  }

  return { size, fileCount }
}

async function collectAreaFilesystemEntries(area: StorageAreaKey, rootPath: string): Promise<FilesystemEntry[]> {
  if (area === 'hls') {
    const entries = await safeReadDirectory(rootPath)
    const collected: FilesystemEntry[] = []

    for (const entry of entries) {
      const fullPath = path.join(rootPath, entry.name)

      if (entry.isDirectory()) {
        const summary = await summarizeDirectory(fullPath)
        collected.push({
          area,
          kind: 'DIRECTORY',
          relativePath: entry.name,
          absolutePath: fullPath,
          name: entry.name,
          size: summary.size,
          fileCount: summary.fileCount,
        })
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const stats = await safeStat(fullPath)
      if (!stats) continue

      collected.push({
        area,
        kind: 'FILE',
        relativePath: entry.name,
        absolutePath: fullPath,
        name: entry.name,
        size: stats.size,
        fileCount: 1,
      })
    }

    return collected
  }

  return collectLeafFiles(area, rootPath)
}

async function buildReferenceIndex() {
  const references = new Map<string, ReferenceEntry>()

  const [audios, thoughts, albumImages] = await Promise.all([
    prisma.audio.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        audioFile: true,
        audioDisplayName: true,
        coverImage: true,
        coverImageDisplayName: true,
        coverImageOriginalName: true,
        hlsManifestPath: true,
      },
    }),
    prisma.thought.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        coverImage: true,
        coverImageDisplayName: true,
        coverImageOriginalName: true,
      },
    }),
    prisma.albumImage.findMany({
      select: {
        id: true,
        title: true,
        displayName: true,
        filePath: true,
        audioCoverFor: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        thoughtCoverFor: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    }),
  ])

  audios.forEach((audio) => {
    const audioEntity: StorageLinkedEntity = {
      type: 'AUDIO',
      entityId: audio.id,
      label: audio.title,
      path: `/audio/${audio.id}/edit`,
      status: audio.status,
    }

    upsertReference(references, {
      area: 'audio',
      kind: 'FILE',
      sourceType: 'AUDIO_FILE',
      sourceLabel: 'File audio',
      name: audio.audioDisplayName || path.basename(audio.audioFile),
      relativePath: normalizeStorageRelativePath(audio.audioFile),
      relatedEntities: [audioEntity],
    })

    if (audio.coverImage) {
      upsertReference(references, {
        area: 'images',
        kind: 'FILE',
        sourceType: 'AUDIO_COVER',
        sourceLabel: 'Copertina audio',
        name: audio.coverImageDisplayName || audio.coverImageOriginalName || path.basename(audio.coverImage),
        relativePath: normalizeStorageRelativePath(audio.coverImage),
        relatedEntities: [audioEntity],
      })
    }

    if (audio.hlsManifestPath) {
      upsertReference(references, {
        area: 'hls',
        kind: 'DIRECTORY',
        sourceType: 'HLS_PACKAGE',
        sourceLabel: 'Pacchetto HLS',
        name: audio.title,
        relativePath: getHlsEntryRelativePath(audio.hlsManifestPath),
        relatedEntities: [audioEntity],
      })
    }
  })

  thoughts.forEach((thought) => {
    if (!thought.coverImage) return

    upsertReference(references, {
      area: 'images',
      kind: 'FILE',
      sourceType: 'THOUGHT_COVER',
      sourceLabel: 'Copertina pensiero',
      name: thought.coverImageDisplayName || thought.coverImageOriginalName || path.basename(thought.coverImage),
      relativePath: normalizeStorageRelativePath(thought.coverImage),
      relatedEntities: [{
        type: 'THOUGHT',
        entityId: thought.id,
        label: thought.title,
        path: `/thoughts/${thought.id}/edit`,
        status: thought.status,
      }],
    })
  })

  albumImages.forEach((image) => {
    const relatedEntities: StorageLinkedEntity[] = [
      ...image.audioCoverFor.map((audio) => ({
        type: 'AUDIO' as const,
        entityId: audio.id,
        label: audio.title,
        path: `/audio/${audio.id}/edit`,
        status: audio.status,
      })),
      ...image.thoughtCoverFor.map((thought) => ({
        type: 'THOUGHT' as const,
        entityId: thought.id,
        label: thought.title,
        path: `/thoughts/${thought.id}/edit`,
        status: thought.status,
      })),
    ]

    upsertReference(references, {
      area: 'images',
      kind: 'FILE',
      sourceType: 'ALBUM_IMAGE',
      sourceLabel: 'Immagine album',
      name: image.title || image.displayName,
      relativePath: normalizeStorageRelativePath(image.filePath),
      relatedEntities,
    })
  })

  return references
}

function mapLargestItem(
  filesystemEntry: FilesystemEntry,
  referenceEntry: ReferenceEntry | undefined,
): StorageLargestItem {
  const areaMeta = STORAGE_AREAS.find((entry) => entry.key === filesystemEntry.area)

  return {
    area: filesystemEntry.area,
    areaLabel: areaMeta?.label || filesystemEntry.area,
    kind: referenceEntry?.kind || filesystemEntry.kind,
    sourceType: referenceEntry?.sourceType || 'UNTRACKED',
    sourceLabel: referenceEntry?.sourceLabel || 'File non tracciato',
    name: referenceEntry?.name || filesystemEntry.name,
    relativePath: filesystemEntry.relativePath,
    absolutePath: filesystemEntry.absolutePath,
    extension: filesystemEntry.kind === 'FILE' ? getFileExtension(referenceEntry?.name || filesystemEntry.name) : null,
    size: filesystemEntry.size,
    fileCount: filesystemEntry.fileCount,
    relatedEntities: referenceEntry?.relatedEntities || [],
  }
}

async function buildStorageItems() {
  const references = await buildReferenceIndex()
  const entriesByArea = await Promise.all(STORAGE_AREAS.map(async (area) => ({
    area,
    entries: await collectAreaFilesystemEntries(area.key, area.rootPath),
  })))

  const items = entriesByArea
    .flatMap(({ entries }) => entries.map((filesystemEntry) => {
      const reference = references.get(buildStorageKey(filesystemEntry.area, filesystemEntry.relativePath))
      return mapLargestItem(filesystemEntry, reference)
    }))
    .sort((left, right) => right.size - left.size)

  return {
    items,
    areas: entriesByArea.map(({ area, entries }) => {
      const areaItems = entries
        .map((filesystemEntry) => {
          const reference = references.get(buildStorageKey(filesystemEntry.area, filesystemEntry.relativePath))
          return mapLargestItem(filesystemEntry, reference)
        })
        .sort((left, right) => right.size - left.size)

      const linkedEntryCount = areaItems.filter((item) => item.relatedEntities.length > 0).length
      const fileCount = areaItems.reduce((total, item) => total + item.fileCount, 0)
      const totalSize = areaItems.reduce((total, item) => total + item.size, 0)

      return {
        key: area.key,
        label: area.label,
        rootPath: area.rootPath,
        totalSize,
        entryCount: areaItems.length,
        fileCount,
        linkedEntryCount,
        unlinkedEntryCount: areaItems.length - linkedEntryCount,
        largestItem: areaItems[0] || null,
      }
    }),
  }
}

export async function getStorageOverview(): Promise<StorageOverview> {
  const { items, areas } = await buildStorageItems()

  const unlinkedItems = items.filter((item) => item.relatedEntities.length === 0)

  return {
    generatedAt: new Date().toISOString(),
    totalSize: items.reduce((total, item) => total + item.size, 0),
    totalEntries: items.length,
    totalPhysicalFiles: items.reduce((total, item) => total + item.fileCount, 0),
    linkedEntries: items.filter((item) => item.relatedEntities.length > 0).length,
    unlinkedEntries: unlinkedItems.length,
    areas,
    largestItems: items.slice(0, 20),
    largestUnlinkedItems: unlinkedItems.slice(0, 10),
  }
}

export async function getPaginatedUnlinkedStorageItems(page: number, limit: number): Promise<PaginatedStorageItems> {
  const { items } = await buildStorageItems()
  const unlinkedItems = items.filter((item) => item.relatedEntities.length === 0)
  const total = unlinkedItems.length
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(page, 1), totalPages)
  const skip = (safePage - 1) * limit

  return {
    data: unlinkedItems.slice(skip, skip + limit),
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
    },
  }
}
