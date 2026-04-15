import { embedText } from './embed'
import { DEBUG } from '@/lib/constants'
import courseEmbeddings from './data/course-embeddings.json'

/**
 * One row in course-embeddings.json: full course record + vector.
 * Schema: schedules.wsu.edu fields.
 */
export type CourseEmbeddingRow = Record<string, unknown> & {
  course_id: number
  prefix: string
  subject: string
  courseNumber: number
  title: string
  embedding: number[]
  sections?: unknown[]
}

export type CourseSearchResult = Omit<CourseEmbeddingRow, 'embedding'>

export type ScoredCourseSummary = {
  course_id: number
  subject: string
  courseNumber: number
  title: string
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
 * Semantic search over embedded course identity (title, subject, prefix, courseNumber, course_id).
 * Returns full course records including all `sections` from course-embeddings.json.
 */
export async function findRelevantCourses(
  query: string,
  limit = 5,
  minScore = 0.62
): Promise<{ courses: CourseSearchResult[]; scoredCourses: ScoredCourseSummary[] }> {
  if (DEBUG) console.log('Vector search query:', query)

  const queryVector = await embedText(query)

  const rows = courseEmbeddings as CourseEmbeddingRow[]

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
      'Search Results:',
      JSON.stringify(
        topCourses.map((c) => ({
          course_id: c.course_id,
          title: c.title,
          score: c.score.toFixed(4),
        })),
        null,
        2
      )
    )
  }

  const scoredCourses: ScoredCourseSummary[] = topCourses.map((c) => ({
    course_id: c.course_id,
    subject: c.subject,
    courseNumber: c.courseNumber,
    title: c.title,
    score: Math.round(c.score * 10000) / 10000,
  }))

  const courses: CourseSearchResult[] = topCourses.map(
    ({ embedding: _emb, score: _score, ...course }) => course as CourseSearchResult
  )

  return { courses, scoredCourses }
}
