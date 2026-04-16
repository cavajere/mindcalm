import { ContentVisibility, Level, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ensureSearchDatabaseSupport } from './searchDatabaseService'

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
  visibilities: ContentVisibility[]
}

export type RankedPostSearchParams = RankedSearchParams & {
  author?: string
  visibilities: ContentVisibility[]
}

type RankedIdRow = {
  id: string
  relevance: number
}

type CountRow = {
  total: bigint | number
}

type SearchDatabaseSupport = Awaited<ReturnType<typeof ensureSearchDatabaseSupport>>

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

function buildPostTagFilter(tagSlugs: string[], matchMode: MatchMode) {
  if (!tagSlugs.length) {
    return Prisma.empty
  }

  if (matchMode === 'all') {
    return Prisma.sql`
      AND (
        SELECT COUNT(DISTINCT t."slug")
        FROM "post_tags" at
        JOIN "tags" t ON t."id" = at."tagId"
        WHERE at."postId" = ar."id"
          AND t."isActive" = true
          AND t."slug" IN (${Prisma.join(tagSlugs)})
      ) = ${tagSlugs.length}
    `
  }

  return Prisma.sql`
    AND EXISTS (
      SELECT 1
      FROM "post_tags" at
      JOIN "tags" t ON t."id" = at."tagId"
      WHERE at."postId" = ar."id"
        AND t."isActive" = true
        AND t."slug" IN (${Prisma.join(tagSlugs)})
    )
  `
}

function parseCount(value: bigint | number): number {
  return typeof value === 'bigint' ? Number(value) : value
}

function buildVisibilityList(visibilities: ContentVisibility[]) {
  return Prisma.join(visibilities.map((visibility) => Prisma.sql`${visibility}::"ContentVisibility"`))
}

function buildLevelFilter(level?: Level) {
  if (!level) {
    return Prisma.empty
  }

  return Prisma.sql`AND a."level" = ${level}::"Level"`
}

function buildSearchQueryCte(search: string, normalizedSearch: string, support: SearchDatabaseSupport) {
  if (support.hasUnaccent && support.hasImmutableUnaccent) {
    return Prisma.sql`
      WITH search_query AS (
        SELECT
          websearch_to_tsquery('simple', unaccent(${search})) AS query,
          lower(immutable_unaccent(${normalizedSearch})) AS normalized
      )
    `
  }

  return Prisma.sql`
    WITH search_query AS (
      SELECT
        websearch_to_tsquery('simple', ${search}) AS query,
        lower(${normalizedSearch}) AS normalized
    )
  `
}

function buildNormalizedTextSql(text: Prisma.Sql, support: SearchDatabaseSupport) {
  if (support.hasUnaccent && support.hasImmutableUnaccent) {
    return Prisma.sql`lower(immutable_unaccent(COALESCE(${text}, '')))`
  }

  return Prisma.sql`lower(COALESCE(${text}, ''))`
}

function buildTsVectorSql(text: Prisma.Sql, support: SearchDatabaseSupport) {
  if (support.hasUnaccent) {
    return Prisma.sql`to_tsvector('simple', unaccent(COALESCE(${text}, '')))`
  }

  return Prisma.sql`to_tsvector('simple', COALESCE(${text}, ''))`
}

function buildSimilarityScoreSql(
  normalizedTitle: Prisma.Sql,
  normalizedLabels: Prisma.Sql,
  support: SearchDatabaseSupport,
) {
  if (!support.hasPgTrgm) {
    return Prisma.sql`0`
  }

  return Prisma.sql`
    GREATEST(
      similarity(${normalizedTitle}, search_query.normalized),
      similarity(${normalizedLabels}, search_query.normalized)
    ) * 0.35
  `
}

function buildSimilarityFilterSql(
  normalizedTitle: Prisma.Sql,
  normalizedLabels: Prisma.Sql,
  support: SearchDatabaseSupport,
) {
  if (!support.hasPgTrgm) {
    return Prisma.sql`
      position(search_query.normalized in ${normalizedTitle}) > 0
      OR position(search_query.normalized in ${normalizedLabels}) > 0
    `
  }

  return Prisma.sql`
    similarity(${normalizedTitle}, search_query.normalized) > 0.12
    OR similarity(${normalizedLabels}, search_query.normalized) > 0.12
  `
}

export async function getRankedPublishedAudioIds(params: RankedAudioSearchParams) {
  const offset = (params.page - 1) * params.limit
  const normalizedSearch = params.search.trim().toLowerCase()
  const tagFilter = buildAudioTagFilter(params.tagSlugs, params.matchMode)
  const durationFilter = buildAudioDurationFilter(params.duration)
  const support = await ensureSearchDatabaseSupport()
  const visibilityList = buildVisibilityList(params.visibilities)

  const normalizedTitle = buildNormalizedTextSql(Prisma.sql`a."title"`, support)
  const normalizedLabels = buildNormalizedTextSql(Prisma.sql`tags."labels"`, support)
  const rankedNormalizedTitle = Prisma.sql`ranked.normalized_title`
  const rankedNormalizedLabels = Prisma.sql`ranked.normalized_labels`
  const titleVector = buildTsVectorSql(Prisma.sql`a."title"`, support)
  const labelsVector = buildTsVectorSql(Prisma.sql`tags."labels"`, support)
  const aliasesVector = buildTsVectorSql(Prisma.sql`tags."aliases"`, support)
  const descriptionVector = buildTsVectorSql(Prisma.sql`a."description"`, support)
  const similarityScore = buildSimilarityScoreSql(rankedNormalizedTitle, rankedNormalizedLabels, support)
  const similarityFilter = buildSimilarityFilterSql(rankedNormalizedTitle, rankedNormalizedLabels, support)

  const baseQuery = Prisma.sql`
    ${buildSearchQueryCte(params.search, normalizedSearch, support)},
    ranked AS (
      SELECT
        a."id",
        a."publishedAt",
        setweight(${titleVector}, 'A') ||
        setweight(${labelsVector}, 'B') ||
        setweight(${aliasesVector}, 'B') ||
        setweight(${descriptionVector}, 'C') AS document,
        ${normalizedTitle} AS normalized_title,
        ${normalizedLabels} AS normalized_labels
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
        AND a."visibility" IN (${visibilityList})
        ${params.categoryId ? Prisma.sql`AND a."categoryId" = ${params.categoryId}` : Prisma.empty}
        ${buildLevelFilter(params.level)}
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
          ${similarityScore}
        ) AS relevance,
        ranked."publishedAt"
      FROM ranked
      CROSS JOIN search_query
      WHERE ranked.document @@ search_query.query
        OR ${similarityFilter}
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

export async function getRankedPublishedPostIds(params: RankedPostSearchParams) {
  const offset = (params.page - 1) * params.limit
  const normalizedSearch = params.search.trim().toLowerCase()
  const tagFilter = buildPostTagFilter(params.tagSlugs, params.matchMode)
  const support = await ensureSearchDatabaseSupport()
  const visibilityList = buildVisibilityList(params.visibilities)

  const normalizedTitle = buildNormalizedTextSql(Prisma.sql`ar."title"`, support)
  const normalizedLabels = buildNormalizedTextSql(Prisma.sql`tags."labels"`, support)
  const rankedNormalizedTitle = Prisma.sql`ranked.normalized_title`
  const rankedNormalizedLabels = Prisma.sql`ranked.normalized_labels`
  const titleVector = buildTsVectorSql(Prisma.sql`ar."title"`, support)
  const labelsVector = buildTsVectorSql(Prisma.sql`tags."labels"`, support)
  const aliasesVector = buildTsVectorSql(Prisma.sql`tags."aliases"`, support)
  const excerptVector = buildTsVectorSql(Prisma.sql`ar."excerpt"`, support)
  const bodyTextVector = buildTsVectorSql(Prisma.sql`ar."bodyText"`, support)
  const similarityScore = buildSimilarityScoreSql(rankedNormalizedTitle, rankedNormalizedLabels, support)
  const similarityFilter = buildSimilarityFilterSql(rankedNormalizedTitle, rankedNormalizedLabels, support)

  const baseQuery = Prisma.sql`
    ${buildSearchQueryCte(params.search, normalizedSearch, support)},
    ranked AS (
      SELECT
        ar."id",
        ar."publishedAt",
        setweight(${titleVector}, 'A') ||
        setweight(${labelsVector}, 'B') ||
        setweight(${aliasesVector}, 'B') ||
        setweight(${excerptVector}, 'C') ||
        setweight(${bodyTextVector}, 'D') AS document,
        ${normalizedTitle} AS normalized_title,
        ${normalizedLabels} AS normalized_labels
      FROM "posts" ar
      LEFT JOIN LATERAL (
        SELECT
          string_agg(DISTINCT t."label", ' ') AS "labels",
          string_agg(DISTINCT ta."alias", ' ') AS "aliases"
        FROM "post_tags" at
        JOIN "tags" t ON t."id" = at."tagId" AND t."isActive" = true
        LEFT JOIN "tag_aliases" ta ON ta."tagId" = t."id"
        WHERE at."postId" = ar."id"
      ) tags ON true
      WHERE ar."status" = 'PUBLISHED'
        AND ar."visibility" IN (${visibilityList})
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
          ${similarityScore}
        ) AS relevance,
        ranked."publishedAt"
      FROM ranked
      CROSS JOIN search_query
      WHERE ranked.document @@ search_query.query
        OR ${similarityFilter}
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
