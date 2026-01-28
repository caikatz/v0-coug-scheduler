// lib/courseSearch.ts
import { qdrant } from './qdrant'
import { embedText } from './embeddings'

export async function findRelevantCourses(
  query: string,
  limit = 5
) {
  const vector = await embedText(query)

  console.log("Vector search querry " + query);

  const results = await qdrant.search('courses', {
    vector,
    limit,
  })

  console.log("Search Result: " + JSON.stringify(results, null, 2))

  return results.map((r) => r.payload)
}
