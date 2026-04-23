import { findRelevantCourses, type CourseSearchResult, type ScoredCourseSummary } from './course-search'
import { findRelevantCatalogCourses, type CatalogSearchResult, type CatalogScoredSummary } from './catalog-search'
import { embedText } from './embed'
import { DEBUG } from '@/lib/constants'

export interface UnifiedSearchResult {
  schedule: {
    courses: CourseSearchResult[]
    scoredCourses: ScoredCourseSummary[]
  }
  catalog: {
    courses: CatalogSearchResult[]
    scoredCourses: CatalogScoredSummary[]
  }
}

/**
 * Runs both schedule and catalog searches in parallel for a single query.
 * The query embedding is computed once and reused would be ideal, but
 * since each search function encapsulates its own embed call we run them
 * concurrently via Promise.all so latency = max(schedule, catalog).
 */
export async function searchCourses(
  query: string,
  limit = 5,
  minScore = 0.62
): Promise<UnifiedSearchResult> {
  if (DEBUG) console.log('[Unified search] query:', query)

  const [schedule, catalog] = await Promise.all([
    findRelevantCourses(query, limit, minScore),
    findRelevantCatalogCourses(query, limit, minScore),
  ])

  if (DEBUG) {
    console.log(
      `[Unified search] schedule: ${schedule.scoredCourses.length} hits, catalog: ${catalog.scoredCourses.length} hits`
    )
  }

  return { schedule, catalog }
}

export type { CourseSearchResult, ScoredCourseSummary } from './course-search'
export type { CatalogSearchResult, CatalogScoredSummary } from './catalog-search'
