/**
 * Text sent to the embedding model for catalog vector search.
 * Schema: catalog.wsu.edu (subject, number, longTitle).
 */
export function buildCatalogEmbeddingText(course: {
  course_id: number
  subject: string
  number: number
  longTitle: string
}): string {
  return [
    course.longTitle,
    `${course.subject.trim()} ${course.number}`,
    `course_id ${course.course_id}`,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n')
}
