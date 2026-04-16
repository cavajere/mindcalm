import type { Request } from 'express'
import { ContentVisibility } from '@prisma/client'

export function getVisibleContentVisibilities(req: Request): ContentVisibility[] {
  const user = req.adminUser
  
  if (!user) {
    // Utenti non autenticati: solo contenuti pubblici
    return [ContentVisibility.PUBLIC]
  }
  
  if (user.tier === 'PREMIUM') {
    // Utenti premium: accesso a tutto (pubblico + riservato)
    return [ContentVisibility.PUBLIC, ContentVisibility.REGISTERED]
  }
  
  // Utenti free: solo contenuti pubblici
  // REGISTERED ora significa "solo premium"
  return [ContentVisibility.PUBLIC]
}

export function canAccessContent(req: Request, contentVisibility: ContentVisibility): boolean {
  const visibleVisibilities = getVisibleContentVisibilities(req)
  return visibleVisibilities.includes(contentVisibility)
}

export function getUserTierLabel(tier?: string): string {
  switch (tier) {
    case 'PREMIUM':
      return 'Premium'
    case 'FREE':
      return 'Free'
    default:
      return 'Sconosciuto'
  }
}

export function getContentVisibilityLabel(visibility: ContentVisibility): string {
  switch (visibility) {
    case ContentVisibility.PUBLIC:
      return 'Visibile a tutti'
    case ContentVisibility.REGISTERED:
      return 'Solo utenti Premium'
    default:
      return 'Sconosciuto'
  }
}
