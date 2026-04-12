import { describe, expect, it } from 'vitest'
import { buildUploadMetadata, renameStoredUpload } from './uploadMetadataService'

describe('uploadMetadataService', () => {
  it('keeps the original upload name and defaults display name to it', () => {
    const metadata = buildUploadMetadata(
      { originalname: 'Meditazione serale.mp3', filename: 'generated.mp3' },
    )

    expect(metadata).toEqual({
      originalName: 'Meditazione serale.mp3',
      displayName: 'Meditazione serale.mp3',
    })
  })

  it('restores the original extension when the display name is renamed without it', () => {
    const metadata = buildUploadMetadata(
      { originalname: 'respira-profondo.wav', filename: 'generated.wav' },
      'Respira profondo finale',
    )

    expect(metadata.displayName).toBe('Respira profondo finale.wav')
  })

  it('prevents mismatched extensions during rename', () => {
    const metadata = renameStoredUpload(
      'copertina.webp',
      'Copertina hero.webp',
      'cover-final.png',
    )

    expect(metadata).toEqual({
      originalName: 'copertina.webp',
      displayName: 'cover-final.webp',
    })
  })
})
