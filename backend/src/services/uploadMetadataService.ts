import path from 'path'

const FALLBACK_NAME = 'file'

export type StoredUploadMetadata = {
  originalName: string
  displayName: string
}

function sanitizeCandidateName(value: string | null | undefined): string {
  if (!value) return ''

  return path.basename(value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitNameAndExtension(fileName: string) {
  const extension = path.extname(fileName)
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName

  return { baseName, extension }
}

function normalizeOriginalName(originalName: string, fallbackName?: string): string {
  const sanitized = sanitizeCandidateName(originalName)
  if (sanitized) return sanitized

  const fallback = sanitizeCandidateName(fallbackName)
  if (fallback) return fallback

  return FALLBACK_NAME
}

function normalizeDisplayName(displayName: string | null | undefined, originalName: string): string {
  const requestedName = sanitizeCandidateName(displayName)
  if (!requestedName) return originalName

  const { extension: originalExtension } = splitNameAndExtension(originalName)
  if (!originalExtension) return requestedName

  const { baseName, extension } = splitNameAndExtension(requestedName)
  if (!extension) {
    return `${requestedName}${originalExtension}`
  }

  if (extension.toLowerCase() !== originalExtension.toLowerCase()) {
    return `${baseName || FALLBACK_NAME}${originalExtension}`
  }

  return requestedName
}

export function buildUploadMetadata(
  file: Pick<Express.Multer.File, 'originalname' | 'filename'>,
  displayName?: string | null,
): StoredUploadMetadata {
  const originalName = normalizeOriginalName(file.originalname, file.filename)

  return {
    originalName,
    displayName: normalizeDisplayName(displayName, originalName),
  }
}

export function renameStoredUpload(
  originalName: string,
  currentDisplayName: string | null | undefined,
  requestedDisplayName: string | null | undefined,
): StoredUploadMetadata {
  const normalizedOriginalName = normalizeOriginalName(originalName, currentDisplayName ?? undefined)
  const fallbackDisplayName = currentDisplayName
    ? normalizeDisplayName(currentDisplayName, normalizedOriginalName)
    : normalizedOriginalName
  const displayName = requestedDisplayName === undefined
    ? fallbackDisplayName
    : normalizeDisplayName(requestedDisplayName, normalizedOriginalName)

  return {
    originalName: normalizedOriginalName,
    displayName,
  }
}
