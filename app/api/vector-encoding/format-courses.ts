// lib/formatCourses.ts

export function formatCoursesForPrompt(courses: any[]): string {
  if (!courses?.length) return ''
  
  return `
### RELEVANT COURSE INFORMATION
Use ONLY the following official course information.
Do NOT invent courses or details.
${courses
  .map(
    (c) => `
• ${c.longTitle || c.shortTitle} (${c.course_id})
  Prefix: ${c.prefix} ${c.number}
  Subject: ${c.subject}
  Credits: ${c.creditsPhrase}
  Requisites: ${c.requisitePhrase || 'None listed'}
  Typically Offered: ${c.typicallyOffered || 'Not specified'}
  Description: ${c.description}
`.trim()
  )
  .join('\n\n')}
`
}