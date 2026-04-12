import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { config } from '../config'
import { deleteDirectory, getHlsDirectoryPath, getHlsFilePath, getHlsRootPath } from './fileService'

const HLS_MASTER_MANIFEST = 'master.m3u8'
const HLS_VARIANT_MANIFEST = 'audio.m3u8'
const HLS_SEGMENT_PATTERN = 'segment_%03d.ts'
const ALLOWED_HLS_EXTENSIONS = new Set(['.m3u8', '.ts'])
let bundledFfmpegPath: string | null | undefined

function buildMasterManifest(): string {
  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-STREAM-INF:BANDWIDTH=${config.audioDelivery.hlsAudioBitrateKbps * 1000},CODECS="mp4a.40.2"`,
    HLS_VARIANT_MANIFEST,
    '',
  ].join('\n')
}

function getBundledFfmpegPath(): string | null {
  if (bundledFfmpegPath !== undefined) {
    return bundledFfmpegPath
  }

  try {
    bundledFfmpegPath = require('ffmpeg-static') as string | null
  } catch {
    bundledFfmpegPath = null
  }

  return bundledFfmpegPath
}

function buildFfmpegUnavailableMessage(executablePath: string, error: NodeJS.ErrnoException) {
  const location = executablePath === 'ffmpeg' ? 'nel PATH di sistema' : `nel percorso configurato (${executablePath})`
  return `FFmpeg non disponibile ${location}: ${error.message}. Esegui npm install oppure imposta FFMPEG_PATH con un binario valido.`
}

async function spawnFfmpeg(executablePath: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executablePath, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      const details = stderr.trim()
      reject(new Error(details ? `Transcodifica HLS fallita: ${details}` : 'Transcodifica HLS fallita'))
    })
  })
}

async function runFfmpeg(args: string[]) {
  try {
    await spawnFfmpeg(config.audioDelivery.ffmpegPath, args)
  } catch (error) {
    const systemError = error as NodeJS.ErrnoException

    if (systemError.code === 'ENOENT' && !process.env.FFMPEG_PATH) {
      const fallbackPath = getBundledFfmpegPath()

      if (fallbackPath && fallbackPath !== config.audioDelivery.ffmpegPath) {
        await spawnFfmpeg(fallbackPath, args)
        return
      }

      throw new Error(buildFfmpegUnavailableMessage(config.audioDelivery.ffmpegPath, systemError))
    }

    if (systemError.code === 'ENOENT') {
      throw new Error(buildFfmpegUnavailableMessage(config.audioDelivery.ffmpegPath, systemError))
    }

    throw error
  }
}

async function ensureDirectory(directoryPath: string) {
  await fs.promises.mkdir(directoryPath, { recursive: true })
}

async function writeMasterManifest(directoryPath: string) {
  await fs.promises.writeFile(
    path.join(directoryPath, HLS_MASTER_MANIFEST),
    buildMasterManifest(),
    'utf8',
  )
}

function buildTemporaryDirectory(audioId: string) {
  return path.join(getHlsRootPath(), `${path.basename(audioId)}__tmp_${Date.now()}`)
}

export async function ensureFfmpegAvailable() {
  await runFfmpeg(['-version'])
}

export async function transcodeAudioFileToHls(audioId: string, inputPath: string) {
  const outputDirectory = buildTemporaryDirectory(audioId)
  await ensureDirectory(outputDirectory)

  try {
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-c:a',
      'aac',
      '-b:a',
      `${config.audioDelivery.hlsAudioBitrateKbps}k`,
      '-f',
      'hls',
      '-hls_time',
      String(config.audioDelivery.hlsSegmentDurationSec),
      '-hls_playlist_type',
      'vod',
      '-hls_segment_filename',
      path.join(outputDirectory, HLS_SEGMENT_PATTERN),
      path.join(outputDirectory, HLS_VARIANT_MANIFEST),
    ])

    await writeMasterManifest(outputDirectory)

    const finalDirectory = getHlsDirectoryPath(audioId)
    deleteDirectory(finalDirectory)
    await fs.promises.rename(outputDirectory, finalDirectory)

    return {
      manifestPath: `hls/${audioId}/${HLS_MASTER_MANIFEST}`,
      outputDirectory: finalDirectory,
    }
  } catch (error) {
    deleteDirectory(outputDirectory)
    throw error
  }
}

export function resolveProtectedHlsAssetPath(manifestPath: string, requestedAsset: string): string {
  const normalizedAsset = path.posix.normalize(requestedAsset).replace(/^(\.\.(\/|\\|$))+/, '')
  const extension = path.posix.extname(normalizedAsset)

  if (!normalizedAsset || normalizedAsset.startsWith('/') || !ALLOWED_HLS_EXTENSIONS.has(extension)) {
    throw new Error('Asset HLS non valido')
  }

  const manifestAbsolutePath = getHlsFilePath(manifestPath)
  const manifestDirectory = path.dirname(manifestAbsolutePath)
  const assetAbsolutePath = path.resolve(manifestDirectory, normalizedAsset)

  if (!assetAbsolutePath.startsWith(manifestDirectory)) {
    throw new Error('Asset HLS non valido')
  }

  return assetAbsolutePath
}

export function getHlsContentType(assetPath: string) {
  const extension = path.extname(assetPath)

  if (extension === '.m3u8') {
    return 'application/vnd.apple.mpegurl'
  }

  return 'video/mp2t'
}
