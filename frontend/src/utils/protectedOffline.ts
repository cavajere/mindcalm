const ACTIVE_USER_STORAGE_KEY = 'mindcalm-active-user'

const SHARED_PROTECTED_CACHE_NAMES = [
  'audio-api',
  'posts-api',
  'audio-details-api',
  'post-details-api',
  'categories-api',
  'cover-images',
  'sessions-api',
  'session-details-api',
]

export function getActiveProtectedUserId(): string | null {
  return localStorage.getItem(ACTIVE_USER_STORAGE_KEY)
}

export function setActiveProtectedUserId(userId: string) {
  localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId)
}

export function clearActiveProtectedUserId() {
  localStorage.removeItem(ACTIVE_USER_STORAGE_KEY)
}

export async function clearProtectedOfflineData(_userId?: string | null) {
  const cacheNames = await caches.keys()
  const protectedCacheNames = cacheNames.filter((cacheName) =>
    SHARED_PROTECTED_CACHE_NAMES.includes(cacheName),
  )

  await Promise.all(protectedCacheNames.map((cacheName) => caches.delete(cacheName)))
}
