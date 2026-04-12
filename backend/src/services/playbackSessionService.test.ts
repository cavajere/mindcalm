import { describe, expect, it } from 'vitest'
import {
  buildPlaybackDirectStreamPath,
  buildPlaybackManifestPath,
  buildPlaybackSessionBasePath,
  getPlaybackCookieName,
  getPlaybackExpiresInSeconds,
} from './playbackSessionService'

describe('playbackSessionService helpers', () => {
  it('keeps playback ttl within configured bounds', () => {
    expect(getPlaybackExpiresInSeconds(60)).toBeGreaterThanOrEqual(1800)
    expect(getPlaybackExpiresInSeconds(999999)).toBeLessThanOrEqual(14400)
  })

  it('builds a scoped playback cookie name', () => {
    expect(getPlaybackCookieName('session-123')).toBe('mindcalm_playback_session-123')
  })

  it('builds a session base path bound to audio and session', () => {
    expect(buildPlaybackSessionBasePath('audio-123', 'session-123')).toBe('/api/v1/audio/audio-123/playback/session-123')
  })

  it('builds manifest and direct playback paths', () => {
    expect(buildPlaybackManifestPath('audio-123', 'session-123')).toBe('/api/v1/audio/audio-123/playback/session-123/master.m3u8')
    expect(buildPlaybackDirectStreamPath('audio-123', 'session-123')).toBe('/api/v1/audio/audio-123/playback/session-123/direct')
  })
})
