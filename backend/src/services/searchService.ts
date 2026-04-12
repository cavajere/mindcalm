import { Level, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type MatchMode = 'any' | 'all'

export type RankedSearchParams = {
  page: number
  limit: number
  search: string
  tagSlugs: string[]
  matchMode: MatchMode
}

export type RankedAudioSearchParams = RankedSearchParams & {
  categoryId?: string
  level?: Level
  duration?: 'short' | 'medium' | 'long'
}

export type RankedArticleSearchParams = RankedSearchParams & {
  author?: string
}

type RankedIdRow = {
  id: string
  relevance: number
}

type CountRow = {
  total: bigint | number
}

function buildAudioDurationFilter(duration?: RankedAudioSearchParams['duration']) {
  if (duration === 'short') {
    return Prisma.sql`AND a."durationSec" < 600`
  }

  if (duration === 'medium') {
    return Prisma.sql`AND a."durationSec" BETWEEN 600 AND 1200`
  }

  if (duration === 'long') {
    return Prisma.sql`AND a."durationSec" > 1200`
  }

  return Prisma.empty
}

function buildAudioTagFilter(tagSlugs: string[], matchMode: MatchMode) {
  if (!tagSlugs.length) {
    return Prisma.empty
  }

  if (matchMode === 'all') {
    return Prisma.sql`
      AND (
        SELECT COUNT(DISTINCT t."slug")
        FROM "audio_tags" at
        JOIN "tags" t ON t."id" = at."tagId"
        WHERE at."audioId" = a."id"
          AND t."isActive" = true
          AND t."slug" IN (${Prisma.join(tagSlugs)})
      ) = ${tagSlugs.length}
    `
  }

  return Prisma.sql`
    AND EXISTS (
      SELECT 1
      FROM "audio_tags" at
      JOIN "tags" t ON t."id" = at."tagId"
      WHERE at."audioId" = a."id"
        AND t."isActive" = true
        AND t."slug" IN (${Prisma.join(tagSlugs)})
    )
  `
}

function buildArticleTagFilter(tagSlugs: string[], matchMode: MatchMode) {
  if (!tagSlugs.length) {
    return Prisma.empty
  }

  if (matchMode === 'all') {
    return Prisma.sql`
      AND (
        SELECT COUNT(DISTINCT t."slug")
        FROM "article_tags" at
        JOIN "tags" t ON t."id" = at."tagId"
        WHERE at."articleId" = ar."id"
          AND t."isActive" = true
          AND t."slug" IN (${Prisma.join(tagSlugs)})
      ) = ${tagSlugs.length}
    `
  }

  return Prisma.sql`
    AND EXISTS (
      SELECT 1
      FROM "article_tags" at
      JOIN "tags" t ON t."id" = at."tagId"
      WHERE at."articleId" = ar."id"
        AND t."isActive" = true
        AND t."slug" IN (${Prisma.join(tagSlugs)})
    )
  `
}

function parseCount(value: bigint | number): number {
  return typeof value === 'bigint' ? Number(value) : value
}

export async function getRankedPublishedAudioIds(params: RankedAudioSearchParams) {
  const offset = (params.page - 1) * params.limit
  const normalizedSearch = params.search.trim().toLowerCase()
  const tagFilter = buildAudioTagFilter(params.tagSlugs, params.matchMode)
  const durationFilter = buildAudioDurationFilter(params.duration)

  const baseQuery = Prisma.sql`
    WITH search_query AS (
      SELECT
        websearch_to_tsquery('simple', unaccent(${params.search})) AS query,
        lower(immutable_unaccent(${normalizedSearch})) AS normalized
    ),
    ranked AS (
      SELECT
        a."id",
        a."publishedAt",
        setweight(to_tsvector('simple', unaccent(COALESCE(a."title", ''))), 'A') ||
        setweight(to_tsvector('simple', unaccent(COALESCE(tags."labels", ''))), 'B') ||
        setweight(to_tsvector('simple', unaccent(COALESCE(tags."aliases", ''))), 'B') ||
        setweight(to_tsvector('simple', unaccent(COALESCE(a."description", ''))), 'C') AS document,
        lower(immutable_unaccent(COALESCE(a."title", ''))) AS normalized_title,
        lower(immutable_unaccent(COALESCE(tags."labels", ''))) AS normalized_labels
      FROM "audio" a
      LEFT JOIN LATERAL (
        SELECT
          string_agg(DISTINCT t."label", ' ') AS "labels",
          string_agg(DISTINCT ta."alias", ' ') AS "aliases"
        FROM "audio_tags" at
        JOIN "tags" t ON t."id" = at."tagId" AND t."isActive" = true
        LEFT JOIN "tag_aliases" ta ON ta."tagId" = t."id"
        WHERE at."audioId" = a."id"
      ) tags ON true
      WHERE a."status" = 'PUBLISHED'
        ${params.categoryId ? Prisma.sql`AND a."categoryId" = ${params.categoryId}` : Prisma.empty}
        ${params.level ? Prisma.sql`AND a."level" = ${params.level}` : Prisma.empty}
        ${durationFilter}
        ${tagFilter}
    ),
    matched AS (
      SELECT
        ranked."id",
        (
          ts_rank_cd(ranked.document, search_query.query) +
          CASE WHEN ranked.normalized_title = search_query.normalized THEN 2 ELSE 0 END +
          CASE WHEN position(search_query.normalized in ranked.normalized_title) > 0 THEN 0.4 ELSE 0 END +
          GREATEST(
            similarity(ranked.normalized_title, search_query.normalized),
            similarity(ranked.normalized_labels, search_query.normalized)
          ) * 0.35
        ) AS relevance,
        ranked."publishedAt"
      FROM ranked
      CROSS JOIN search_query
      WHERE ranked.document @@ search_query.query
        OR similarity(ranked.normalized_title, search_query.normalized) > 0.12
        OR similarity(ranked.normalized_labels, search_query.normalized) > 0.12
    )
  `

  const [rows, totalRows] = await Promise.all([
    prisma.$queryRaw<RankedIdRow[]>(Prisma.sql`
      ${baseQuery}
      SELECT matched."id", matched.relevance
      FROM matched
      ORDER BY matched.relevance DESC, matched."publishedAt" DESC NULLS LAST
      LIMIT ${params.limit}
      OFFSET ${offset}
    `),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      ${baseQuery}
      SELECT COUNT(*)::bigint AS total
      FROM matched
    `),
  ])

  return {
    ids: rows.map(row => row.id),
    total: parseCount(totalRows[0]?.total ?? 0),
  }
}

export async function getRankedPublishedArticleIds(params: RankedArticleSearchParams) {
  const offset = (params.page - 1) * params.limit
  const normalizedSearch = params.search.trim().toLowerCase()
  const tagFilter = buildArticleTagFilter(params.tagSlugs, params.matchMode)

  const baseQuery = Prisma.sql`
    WITH search_query AS (
      SELECT
        websearch_to_tsquery('simple', unaccent(${params.search})) AS query,
        lower(immutable_unaccent(${normalizedSearch})) AS normalized
    ),
    ranked AS (
      SELECT
        ar."id",
        ar."publishedAt",
        setweight(to_tsvector('simple', unaccent(COALESCE(ar."title", ''))), 'A') ||
        setweight(to_tsvector('simple', unaccent(COALESCE(tags."labels", ''))), 'B') ||
        setweight(to_tsvector('simple', unaccent(COALESCE(tags."aliases", ''))), 'B') ||
        setweight(to_tsvector('simple', unaccent(COALESCE(ar."excerpt", ''))), 'C') ||
        setweight(to_tsvector('simple', unaccent(COALESCE(ar."bodyText", ''))), 'D') AS document,
        lower(immutable_unaccent(COALESCE(ar."title", ''))) AS normalized_title,
        lower(immutable_unaccent(COALESCE(tags."labels", ''))) AS normalized_labels
      FROM "articles" ar
      LEFT JOIN LATERAL (
        SELECT
          string_agg(DISTINCT t."label", ' ') AS "labels",
          string_agg(DISTINCT ta."alias", ' ') AS "aliases"
        FROM "article_tags" at
        JOIN "tags" t ON t."id" = at."tagId" AND t."isActive" = true
        LEFT JOIN "tag_aliases" ta ON ta."tagId" = t."id"
        WHERE at."articleId" = ar."id"
      ) tags ON true
      WHERE ar."status" = 'PUBLISHED'
        ${params.author ? Prisma.sql`AND lower(ar."author") = lower(${params.author})` : Prisma.empty}
        ${tagFilter}
    ),
    matched AS (
      SELECT
        ranked."id",
        (
          ts_rank_cd(ranked.document, search_query.query) +
          CASE WHEN ranked.normalized_title = search_query.normalized THEN 2 ELSE 0 END +
          CASE WHEN position(search_query.normalized in ranked.normalized_title) > 0 THEN 0.4 ELSE 0 END +
          GREATEST(
            similarity(ranked.normalized_title, search_query.normalized),
            similarity(ranked.normalized_labels, search_query.normalized)
          ) * 0.35
        ) AS relevance,
        ranked."publishedAt"
      FROM ranked
      CROSS JOIN search_query
      WHERE ranked.document @@ search_query.query
        OR similarity(ranked.normalized_title, search_query.normalized) > 0.12
        OR similarity(ranked.normalized_labels, search_query.normalized) > 0.12
    )
  `

  const [rows, totalRows] = await Promise.all([
    prisma.$queryRaw<RankedIdRow[]>(Prisma.sql`
      ${baseQuery}
      SELECT matched."id", matched.relevance
      FROM matched
      ORDER BY matched.relevance DESC, matched."publishedAt" DESC NULLS LAST
      LIMIT ${params.limit}
      OFFSET ${offset}
    `),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      ${baseQuery}
      SELECT COUNT(*)::bigint AS total
      FROM matched
    `),
  ])

  return {
    ids: rows.map(row => row.id),
    total: parseCount(totalRows[0]?.total ?? 0),
  }
}
