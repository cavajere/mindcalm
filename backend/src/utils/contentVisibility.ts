import type { Request } from 'express'
import { ContentVisibility } from '@prisma/client'

export function getVisibleContentVisibilities(req: Request): ContentVisibility[] {
  return req.adminUser
    ? [ContentVisibility.PUBLIC, ContentVisibility.REGISTERED]
    : [ContentVisibility.PUBLIC]
}
