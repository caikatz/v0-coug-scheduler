/**
 * Text sent to the embedding model for vector search.
 * Only these fields participate in similarity — full course + sections are stored separately.
 *
 * Schema: schedules.wsu.edu (prefix, subject, courseNumber, title).
 */
export function buildCourseEmbeddingText(course: {
  course_id: number
  prefix: string
  subject: string
  courseNumber: number
  title: string
}): string {
  return [
    course.title,
    `${course.subject.trim()} ${course.courseNumber}`,
    `${course.prefix.trim()} ${course.courseNumber}`,
    `course_id ${course.course_id}`,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n')
}
