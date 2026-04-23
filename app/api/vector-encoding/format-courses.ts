import type { CourseSearchResult } from './course-search'
import type { CatalogSearchResult } from './catalog-search'
import type { UnifiedSearchResult } from './unified-search'

/**
 * Builds the AI prompt block for schedule (current-term) search results.
 * Schema: schedules.wsu.edu (prefix, subject, courseNumber, title, sections, etc.).
 */
export function formatScheduleCoursesForPrompt(courses: CourseSearchResult[]): string {
  if (!courses?.length) return ''

  return courses
    .map((c) => {
      const sections = Array.isArray(c.sections) ? c.sections : []
      const sectionBlocks = sections.map((sec, i) => {
        const lines = Object.entries(sec as Record<string, unknown>)
          .map(([k, v]) => {
            if (v === null || v === undefined || v === '') return null
            const val =
              typeof v === 'object' ? JSON.stringify(v) : String(v)
            return `    ${k}: ${val}`
          })
          .filter(Boolean)
        return `  Section ${i + 1}:\n${lines.join('\n')}`
      })

      const subject = typeof c.subject === 'string' ? c.subject.trim() : ''

      const meta = [
        `course_id: ${c.course_id}`,
        `subject: ${subject}`,
        `courseNumber: ${c.courseNumber}`,
        `title: ${c.title}`,
        c.credits != null && c.credits !== '' ? `credits: ${c.credits}` : null,
        c.courseDescription != null && String(c.courseDescription).trim()
          ? `courseDescription: ${c.courseDescription}`
          : null,
        c.coursePrerequisite != null && String(c.coursePrerequisite).trim()
          ? `coursePrerequisite: ${c.coursePrerequisite}`
          : null,
        c.campus != null ? `campus: ${c.campus}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      return `* ${c.title} (${subject} ${c.courseNumber})
${meta}
${sectionBlocks.length ? sectionBlocks.join('\n\n') : '  (no sections)'}
`.trim()
    })
    .join('\n\n')
}

/**
 * Builds the AI prompt block for catalog search results.
 * Schema: catalog.wsu.edu (subject, number, longTitle, description, etc.).
 */
export function formatCatalogCoursesForPrompt(courses: CatalogSearchResult[]): string {
  if (!courses?.length) return ''

  return courses
    .map((c) => {
      const subject = typeof c.subject === 'string' ? c.subject.trim() : ''

      const meta = [
        `course_id: ${c.course_id}`,
        `subject: ${subject}`,
        `number: ${c.number}`,
        `title: ${c.longTitle}`,
        c.creditsPhrase != null && String(c.creditsPhrase).trim()
          ? `credits: ${c.creditsPhrase}`
          : null,
        c.description != null && String(c.description).trim()
          ? `description: ${c.description}`
          : null,
        c.requisitePhrase != null && String(c.requisitePhrase).trim()
          ? `prerequisites: ${c.requisitePhrase}`
          : null,
        c.typicallyOffered != null && String(c.typicallyOffered).trim()
          ? `typicallyOffered: ${c.typicallyOffered}`
          : null,
        c.prefixTitle != null && String(c.prefixTitle).trim()
          ? `department: ${c.prefixTitle}`
          : null,
      ]
        .filter(Boolean)
        .join('\n')

      return `* ${c.longTitle} (${subject} ${c.number})
${meta}
`.trim()
    })
    .join('\n\n')
}

/**
 * Builds a unified AI prompt with both schedule and catalog results
 * clearly separated into labeled sections.
 */
export function formatUnifiedResultsForPrompt(results: UnifiedSearchResult): string {
  const parts: string[] = [
    '### RELEVANT COURSE INFORMATION',
    'Use ONLY the following official course information.',
    'Do NOT invent courses or details.',
    '',
  ]

  const hasSchedule = results.schedule.courses.length > 0
  const hasCatalog = results.catalog.courses.length > 0

  if (hasSchedule) {
    parts.push('## CURRENT TERM COURSES (with sections, times, and enrollment)')
    parts.push(formatScheduleCoursesForPrompt(results.schedule.courses))
    parts.push('')
  }

  if (hasCatalog) {
    parts.push('## CATALOG COURSES (descriptions, prerequisites, typically offered)')
    parts.push(formatCatalogCoursesForPrompt(results.catalog.courses))
    parts.push('')
  }

  if (!hasSchedule && !hasCatalog) {
    parts.push('No matching courses found in either the current term schedule or the course catalog.')
  }

  return parts.join('\n')
}
