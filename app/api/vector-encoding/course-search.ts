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
 * Find the most relevant courses based on semantic similarity
 */
export async function findRelevantCourses(
  query: string,
  limit = 5
): Promise<any[]> {
  console.log('Vector search query:', query)

  // Embed the search query
  const queryVector = await embedText(query)

  // Calculate similarity scores for all courses
  const coursesWithScores = (courseEmbeddings as CourseEmbedding[]).map((course) => ({
    ...course,
    score: cosineSimilarity(queryVector, course.embedding)
  }))

  // Sort by similarity score (highest first) and take top results
  const topCourses = coursesWithScores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  console.log('Search Results:', JSON.stringify(
    topCourses.map(c => ({ 
      course_id: c.course_id, 
      title: c.shortTitle, 
      score: c.score 
    })), 
    null, 
    2
  ))

  // Remove embedding and score from returned results
  return topCourses.map(({ embedding, score, ...course }) => course)
}