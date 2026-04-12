import { describe, expect, it } from 'vitest'
import { resolveProtectedHlsAssetPath } from './audioDeliveryService'

describe('audioDeliveryService', () => {
  it('resolves HLS assets inside the manifest directory', () => {
    const resolved = resolveProtectedHlsAssetPath('hls/audio-123/master.m3u8', 'segment_001.ts')
    expect(resolved.endsWith('/hls/audio-123/segment_001.ts') || resolved.endsWith('\\hls\\audio-123\\segment_001.ts')).toBe(true)
  })

  it('rejects invalid HLS assets', () => {
    expect(() => resolveProtectedHlsAssetPath('hls/audio-123/master.m3u8', '../secret.env')).toThrow()
    expect(() => resolveProtectedHlsAssetPath('hls/audio-123/master.m3u8', 'nested/segment.mp4')).toThrow()
  })
})
