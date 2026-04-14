import slugify from 'slugify'
import { prisma } from '../lib/prisma'
import { getStringList } from '../utils/request'

export const MAX_TAGS_PER_CONTENT = 10
export const MAX_ALIASES_PER_TAG = 10

export type TagSummary = {
  id: string
  label: string
  slug: string
}

export function normalizeTagLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function createTagSlug(label: string): string {
  return slugify(normalizeTagLabel(label), { lower: true, strict: true, trim: true })
}

export function parseTagIds(value: unknown): string[] {
  return [...new Set(getStringList(value))]
}

export function normalizeTagAliases(value: unknown): string[] {
  const aliases = getStringList(value)
    .map(alias => normalizeTagLabel(alias))
    .filter(alias => alias.length > 0 && alias.length <= 50)

  return [...new Set(aliases)].slice(0, MAX_ALIASES_PER_TAG)
}

export function mapAudioTags(audioTags: Array<{ tag: TagSummary }>): TagSummary[] {
  return audioTags
    .map(entry => entry.tag)
    .sort((a, b) => a.label.localeCompare(b.label, 'it'))
}

export function mapThoughtTags(thoughtTags: Array<{ tag: TagSummary }>): TagSummary[] {
  return thoughtTags
    .map(entry => entry.tag)
    .sort((a, b) => a.label.localeCompare(b.label, 'it'))
}

export async function ensureTagsExist(tagIds: string[]): Promise<void> {
  if (!tagIds.length) return

  const existing = await prisma.tag.findMany({
    where: { id: { in: tagIds } },
    select: { id: true },
  })

  if (existing.length !== tagIds.length) {
    throw new Error('Uno o più tag non esistono')
  }
}

export async function ensureUniqueTag(label: string, excludeId?: string): Promise<void> {
  const normalizedLabel = normalizeTagLabel(label)
  const slug = createTagSlug(normalizedLabel)

  const existing = await prisma.tag.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        { label: { equals: normalizedLabel, mode: 'insensitive' } },
        { slug },
      ],
    },
    select: { id: true },
  })

  if (existing) {
    throw new Error('Esiste gia un tag con un nome simile')
  }
}
