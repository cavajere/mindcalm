import fs from 'fs'
import path from 'path'
import { config } from '../config'

export function deleteFile(filePath: string): void {
  const fullPath = resolveStoragePath(filePath)
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath)
  }
}

export function resolveStoragePath(relativePath: string): string {
  // Previeni path traversal
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '')

  if (normalized.startsWith('audio/')) {
    return path.join(config.storage.audioPath, path.basename(normalized))
  }
  if (normalized.startsWith('hls/')) {
    return path.join(config.storage.hlsPath, normalized.replace(/^hls\//, ''))
  }
  if (normalized.startsWith('images/')) {
    return path.join(config.storage.imagesPath, path.basename(normalized))
  }

  throw new Error('Path di storage non valido')
}

export function getAudioFilePath(fileName: string): string {
  return path.join(config.storage.audioPath, path.basename(fileName))
}

export function getHlsRootPath(): string {
  return config.storage.hlsPath
}

export function getHlsDirectoryPath(audioId: string): string {
  return path.join(config.storage.hlsPath, path.basename(audioId))
}

export function getHlsFilePath(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '')
  const withoutPrefix = normalized.replace(/^hls\//, '')
  return path.join(config.storage.hlsPath, withoutPrefix)
}

export function getImageFilePath(fileName: string): string {
  return path.join(config.storage.imagesPath, path.basename(fileName))
}

export function deleteDirectory(directoryPath: string): void {
  if (fs.existsSync(directoryPath)) {
    fs.rmSync(directoryPath, { recursive: true, force: true })
  }
}
