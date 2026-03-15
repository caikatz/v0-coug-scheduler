// lib/courseSearch.ts
import { embedText } from './embed'
import courseEmbeddings from './data/course-embeddings.json'

interface CourseEmbedding {
  course_id: string
  prefix: string
  number: string
  subject: string
  longTitle?: string
  shortTitle: string
  creditsPhrase: string
  requisitePhrase?: string
  typicallyOffered?: string
  description: string
  embedding: number[]
}

/**
 * Calculate cosine similarity between two vectors
 */
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
 * Find the most relevant courses based on semantic similarity.
 * @param minScore - minimum cosine similarity to include (default 0.62)
 */
export async function findRelevantCourses(
  query: string,
  limit = 5,
  minScore = 0.62
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ courses: any[]; scoredCourses: { course_id: string; shortTitle: string; score: number }[] }> {
  console.log('Vector search query:', query)

  const queryVector = await embedText(query)

  const coursesWithScores = (courseEmbeddings as CourseEmbedding[]).map((course) => ({
    ...course,
    score: cosineSimilarity(queryVector, course.embedding)
  }))

  const topCourses = coursesWithScores
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  console.log('Search Results:', JSON.stringify(
    topCourses.map(c => ({ 
      course_id: c.course_id, 
      title: c.shortTitle, 
      score: c.score.toFixed(4)
    })), 
    null, 
    2
  ))

  const scoredCourses = topCourses.map((c) => ({
    course_id: c.course_id,
    shortTitle: c.shortTitle,
    score: Math.round(c.score * 10000) / 10000,
  }))

  const courses = topCourses.map(({ embedding, score, ...course }) => course)

  return { courses, scoredCourses }
}