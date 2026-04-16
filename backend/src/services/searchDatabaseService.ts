import { prisma } from '../lib/prisma'

type SearchDatabaseSupport = {
  hasUnaccent: boolean
  hasPgTrgm: boolean
  hasImmutableUnaccent: boolean
}

type SearchDatabaseSupportRow = {
  has_unaccent: boolean
  has_pg_trgm: boolean
  has_immutable_unaccent: boolean
}

let searchDatabaseSupportPromise: Promise<SearchDatabaseSupport> | null = null

async function detectSearchDatabaseSupport(): Promise<SearchDatabaseSupport> {
  const [row] = await prisma.$queryRaw<SearchDatabaseSupportRow[]>`
    SELECT
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') AS has_unaccent,
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS has_pg_trgm,
      EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'immutable_unaccent'
          AND pg_function_is_visible(oid)
      ) AS has_immutable_unaccent
  `

  return {
    hasUnaccent: Boolean(row?.has_unaccent),
    hasPgTrgm: Boolean(row?.has_pg_trgm),
    hasImmutableUnaccent: Boolean(row?.has_immutable_unaccent),
  }
}

async function tryInitializeSearchDatabaseSupport() {
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS unaccent')
  } catch (error) {
    console.warn('[Search][DB] Unable to ensure unaccent extension', error)
  }

  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm')
  } catch (error) {
    console.warn('[Search][DB] Unable to ensure pg_trgm extension', error)
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION immutable_unaccent(text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      PARALLEL SAFE
      AS $$
        SELECT unaccent('public.unaccent', $1)
      $$;
    `)
  } catch (error) {
    console.warn('[Search][DB] Unable to ensure immutable_unaccent function', error)
  }
}

export async function ensureSearchDatabaseSupport() {
  if (!searchDatabaseSupportPromise) {
    searchDatabaseSupportPromise = (async () => {
      await tryInitializeSearchDatabaseSupport()
      const support = await detectSearchDatabaseSupport()

      console.info('[Search][DB] support', support)
      return support
    })().catch((error) => {
      searchDatabaseSupportPromise = null
      throw error
    })
  }

  return searchDatabaseSupportPromise
}
