import axios from 'axios'

async function trackEvent(payload: {
  eventType: 'AUDIO_VIEW' | 'AUDIO_PLAY' | 'AUDIO_COMPLETE' | 'ARTICLE_VIEW'
  audioId?: string
  articleId?: string
}) {
  try {
    await axios.post('/api/analytics/events', payload)
  } catch {
    // Analytics must not block the user flow.
  }
}

export function trackAudioView(audioId: string) {
  return trackEvent({ eventType: 'AUDIO_VIEW', audioId })
}

export function trackAudioPlay(audioId: string) {
  return trackEvent({ eventType: 'AUDIO_PLAY', audioId })
}

export function trackAudioComplete(audioId: string) {
  return trackEvent({ eventType: 'AUDIO_COMPLETE', audioId })
}

export function trackArticleView(articleId: string) {
  return trackEvent({ eventType: 'ARTICLE_VIEW', articleId })
}
