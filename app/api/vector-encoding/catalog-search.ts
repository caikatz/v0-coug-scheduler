import { embedText } from './embed'
import { DEBUG } from '@/lib/constants'
import catalogEmbeddings from './data/catalog-embeddings.json'

/**
 * One row in catalog-embeddings.json: catalog course record + vector.
 * Schema: catalog.wsu.edu fields.
 */
export type CatalogEmbeddingRow = Record<string, unknown> & {
  course_id: number
  subject: string
  number: number
  longTitle: string
  shortTitle?: string
  creditsPhrase?: string
  requisitePhrase?: string
  description?: string
  typicallyOffered?: string
  prefixTitle?: string
  embedding: number[]
}

export type CatalogSearchResult = Omit<CatalogEmbeddingRow, 'embedding'>

export type CatalogScoredSummary = {
  course_id: number
  subject: string
  number: number
  longTitle: string
  score: number
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    magnitudeA += vecA[i] * vecA[i]
    magnitudeB += vecB[i] * vecB[i]
  }

  magnitudeA = Math.sqrt(magnitudeA)
  magnitudeB = Math.sqrt(magnitudeB)

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }

  return dotProduct / (magnitudeA * magnitudeB)
}

/**
 * Semantic search over the WSU course catalog (catalog.wsu.edu).
 * Returns courses with descriptions, prerequisites, typically offered, etc.
 */
export async function findRelevantCatalogCourses(
  query: string,
  limit = 5,
  minScore = 0.62
): Promise<{ courses: CatalogSearchResult[]; scoredCourses: CatalogScoredSummary[] }> {
  const rows = catalogEmbeddings as CatalogEmbeddingRow[]

  if (rows.length === 0) {
    if (DEBUG) console.log('[Catalog search] No catalog embeddings loaded (catalog-embeddings.json is empty)')
    return { courses: [], scoredCourses: [] }
  }

  if (DEBUG) console.log('[Catalog search] query:', query)

  const queryVector = await embedText(query)

  const coursesWithScores = rows.map((row) => ({
    ...row,
    score: cosineSimilarity(queryVector, row.embedding),
  }))

  const topCourses = coursesWithScores
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  if (DEBUG) {
    console.log(
      '[Catalog search] Results:',
      JSON.stringify(
        topCourses.map((c) => ({
          course_id: c.course_id,
          longTitle: c.longTitle,
          score: c.score.toFixed(4),
        })),
        null,
        2
      )
    )
  }

  const scoredCourses: CatalogScoredSummary[] = topCourses.map((c) => ({
    course_id: c.course_id,
    subject: c.subject,
    number: c.number,
    longTitle: c.longTitle,
    score: Math.round(c.score * 10000) / 10000,
  }))

  const courses: CatalogSearchResult[] = topCourses.map(
    ({ embedding: _emb, score: _score, ...course }) => course as CatalogSearchResult
  )

  return { courses, scoredCourses }
}
