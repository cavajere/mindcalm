import { AudioProcessingStatus, StreamingFormat } from '@prisma/client'
import fs from 'fs'
import { prisma } from '../lib/prisma'
import { ensureFfmpegAvailable, transcodeAudioFileToHls } from '../services/audioDeliveryService'
import { getAudioFilePath } from '../services/fileService'

async function main() {
  await ensureFfmpegAvailable()

  const audioItems = await prisma.audio.findMany({
    where: {
      OR: [
        { streamingFormat: StreamingFormat.DIRECT },
        { hlsManifestPath: null },
        { processingStatus: { not: AudioProcessingStatus.READY } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`[backfill-hls] Audio da convertire: ${audioItems.length}`)

  for (const audio of audioItems) {
    const sourcePath = getAudioFilePath(audio.audioFile)

    if (!fs.existsSync(sourcePath)) {
      console.warn(`[backfill-hls] Sorgente mancante per ${audio.id} (${audio.title})`)
      await prisma.audio.update({
        where: { id: audio.id },
        data: {
          processingStatus: AudioProcessingStatus.FAILED,
          processingError: 'File sorgente mancante per il backfill HLS',
        },
      })
      continue
    }

    await prisma.audio.update({
      where: { id: audio.id },
      data: {
        processingStatus: AudioProcessingStatus.PENDING,
        processingError: null,
      },
    })

    try {
      const hlsAsset = await transcodeAudioFileToHls(audio.id, sourcePath)
      await prisma.audio.update({
        where: { id: audio.id },
        data: {
          streamingFormat: StreamingFormat.HLS,
          processingStatus: AudioProcessingStatus.READY,
          hlsManifestPath: hlsAsset.manifestPath,
          processingError: null,
        },
      })
      console.log(`[backfill-hls] OK ${audio.id} (${audio.title})`)
    } catch (error) {
      await prisma.audio.update({
        where: { id: audio.id },
        data: {
          processingStatus: AudioProcessingStatus.FAILED,
          processingError: (error as Error).message,
        },
      })
      console.error(`[backfill-hls] FAIL ${audio.id} (${audio.title}): ${(error as Error).message}`)
    }
  }
}

main()
  .catch((error) => {
    console.error('[backfill-hls] Errore fatale', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
